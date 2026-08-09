import "server-only";

import { cache } from "react";

import { getCategories, type Category, type Product } from "@/lib/catalog/queries";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

export type ShoppingList = Database["public"]["Tables"]["shopping_lists"]["Row"];
export type ShoppingListItem = Database["public"]["Tables"]["shopping_list_items"]["Row"];

/** An item with the catalogue row it points at, so the UI can render a
 * name without a second round trip. */
export interface ListEntry {
  item: ShoppingListItem;
  product: Product;
}

/** One category's worth of a list. `13-shopping-list-grouping-checklist.md`
 * §2 — the unit the worker reviews and the owner shops. */
export interface ListGroup {
  category: Category;
  entries: ListEntry[];
}

export interface DraftList {
  list: ShoppingList;
  groups: ListGroup[];
  itemCount: number;
}

/**
 * The caller's open draft for a household, with its items grouped by
 * category.
 *
 * Read-only: it never creates a list. Opening the app must not mint a
 * draft row just because someone glanced at the home screen — the draft
 * is created on the first *add*, via the `get_or_create_draft_list` RPC
 * inside the add action.
 */
export const getDraftList = cache(async (householdId: string): Promise<DraftList | null> => {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // RLS scopes shopping_lists to the caller's households; the
  // created_by_user_id filter narrows that to the caller's own drafts,
  // which is the stricter rule the RPCs enforce on writes.
  const { data: lists } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("household_id", householdId)
    .eq("created_by_user_id", user.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1);

  const list = lists?.[0];
  if (!list) return null;

  return { ...(await loadGroups(list)), list };
});

/** productId → quantity, for the browse screens: every stepper needs to
 * know whether its product is already on the list, and at what count. */
export function quantitiesByProduct(draft: DraftList | null): Record<string, number> {
  if (!draft) return {};
  return Object.fromEntries(
    draft.groups.flatMap((group) =>
      group.entries.map((entry) => [entry.item.product_id, Number(entry.item.quantity)]),
    ),
  );
}

/** A specific list of the caller's, in any status — used by the send
 * confirmation screen, which reads a list that is no longer a draft. */
export async function getListById(listId: string): Promise<DraftList | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: lists } = await supabase
    .from("shopping_lists")
    .select("*")
    .eq("id", listId)
    .eq("created_by_user_id", user.id)
    .limit(1);

  const list = lists?.[0];
  if (!list) return null;

  return { ...(await loadGroups(list)), list };
}

async function loadGroups(list: ShoppingList): Promise<Omit<DraftList, "list">> {
  const supabase = await createClient();

  const [{ data: items }, categories] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("list_id", list.id)
      .order("sort_order", { ascending: true }),
    getCategories(),
  ]);

  if (!items || items.length === 0) return { groups: [], itemCount: 0 };

  const productIds = [...new Set(items.map((item) => item.product_id))];
  const { data: products } = await supabase.from("products").select("*").in("id", productIds);

  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  return { groups: groupEntries(items, productById, categories), itemCount: items.length };
}

/**
 * Groups items by the category recorded ON THE ITEM, not the one the
 * product currently sits in.
 *
 * That distinction is the whole point of `shopping_list_items.category_id`
 * being a snapshot (Amendment 1 §16A.4): a catalogue re-import that
 * re-files a product must not silently reshuffle a list that has already
 * been sent. Joining live to `products.category_id` here would quietly
 * undo the guarantee the database is keeping.
 *
 * Category order follows `categories.sort_order` (aisle order), and items
 * within a category follow their own snapshotted `sort_order`. Both are
 * asserted unique, so the result is deterministic — the same list renders
 * identically on every device (§16A, 11-product-catalog-architecture.md §7.6).
 */
export function groupEntries(
  items: ShoppingListItem[],
  productById: Map<string, Product>,
  categories: Category[],
): ListGroup[] {
  const entriesByCategory = new Map<string, ListEntry[]>();

  for (const item of items) {
    const product = productById.get(item.product_id);
    // An item whose product row is unreadable cannot be rendered. This
    // should not happen — products are never deleted, only deactivated —
    // so dropping it is safer than showing a blank row.
    if (!product) continue;

    const bucket = entriesByCategory.get(item.category_id);
    if (bucket) bucket.push({ item, product });
    else entriesByCategory.set(item.category_id, [{ item, product }]);
  }

  return categories
    .filter((category) => entriesByCategory.has(category.id))
    .map((category) => ({
      category,
      entries: entriesByCategory
        .get(category.id)!
        .sort((a, b) => a.item.sort_order - b.item.sort_order),
    }));
}
