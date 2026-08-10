import "server-only";

import { cache } from "react";

import { getCategories, type Category, type Product } from "@/lib/catalog/queries";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

export type ShoppingList = Database["public"]["Tables"]["shopping_lists"]["Row"];
export type ShoppingListItem = Database["public"]["Tables"]["shopping_list_items"]["Row"];

/**
 * An item together with whatever identifies it.
 *
 * Exactly one of the two is set, mirroring the database's
 * `shopping_list_items_product_xor_photo` constraint: a catalogue item
 * has a `product`, a photographed item has a `photoUrl`. The UI branches
 * on which is present rather than on a separate kind flag, so a row that
 * somehow had neither renders as nothing at all instead of as a blank
 * line the household cannot act on.
 */
export interface ListEntry {
  item: ShoppingListItem;
  product: Product | null;
  /** Signed URL into the private list-photos bucket. Short-lived by
   * design — see `19-photo-items.md` §3. */
  photoUrl: string | null;
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
      group.entries
        // Photographed items have no product to key on, and no stepper on
        // any browse screen to inform.
        .filter((entry) => entry.item.product_id !== null)
        .map((entry) => [entry.item.product_id as string, Number(entry.item.quantity)]),
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

  const productIds = [...new Set(items.map((item) => item.product_id))].filter(
    (id): id is string => id !== null,
  );
  const { data: products } = productIds.length
    ? await supabase.from("products").select("*").in("id", productIds)
    : { data: [] };

  const productById = new Map((products ?? []).map((product) => [product.id, product]));
  const photoUrlByPath = await signPhotoPaths(items);

  return {
    groups: groupEntries(items, productById, categories, photoUrlByPath),
    itemCount: items.length,
  };
}

/**
 * Turns photo object paths into short-lived signed URLs.
 *
 * The bucket is private, so there is no stable public URL to render and
 * the browser cannot fetch the object with the page's session alone.
 * Signing happens here, server-side, using the caller's own client —
 * which means RLS decides: a caller who is not an active member of the
 * household gets no URL back, and the check is the same one that governs
 * the list itself.
 *
 * Returns an empty map when there are no photographs, which is the
 * common case; it costs no round trip.
 */
export async function signPhotoPaths(items: ShoppingListItem[]): Promise<Map<string, string>> {
  const paths = items
    // A purged photograph has no object left to sign. Asking anyway would
    // cost a round trip and return an error for every completed list.
    .filter((item) => item.photo_deleted_at === null)
    .map((item) => item.photo_path)
    .filter((path): path is string => path !== null);

  if (paths.length === 0) return new Map();

  const supabase = await createClient();
  const { data } = await supabase.storage
    .from("list-photos")
    .createSignedUrls(paths, PHOTO_URL_TTL_SECONDS);

  const signed = new Map<string, string>();
  for (const entry of data ?? []) {
    // An entry can come back with a null URL when the caller may not read
    // that object — RLS deciding, which is the intended behaviour, not an
    // error to surface.
    if (entry.path && entry.signedUrl) signed.set(entry.path, entry.signedUrl);
  }
  return signed;
}

/**
 * One hour. Long enough that a shopper walking a supermarket does not
 * watch images expire mid-aisle, short enough that a URL copied out of
 * the page stops working the same day. The page is server-rendered per
 * request, so every load mints fresh ones.
 */
const PHOTO_URL_TTL_SECONDS = 60 * 60;

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
  photoUrlByPath: Map<string, string> = new Map(),
): ListGroup[] {
  const entriesByCategory = new Map<string, ListEntry[]>();

  for (const item of items) {
    let entry: ListEntry;

    if (item.photo_path !== null) {
      // A photographed item identifies itself. A missing signed URL means
      // the caller may not read the object — which RLS decides, not this
      // code — so the item is still shown, with its quantity and note,
      // rather than disappearing from a checklist someone is shopping.
      entry = { item, product: null, photoUrl: photoUrlByPath.get(item.photo_path) ?? null };
    } else {
      const product = item.product_id ? productById.get(item.product_id) : undefined;
      // An item whose product row is unreadable cannot be rendered. This
      // should not happen — products are never deleted, only deactivated —
      // so dropping it is safer than showing a blank row.
      if (!product) continue;
      entry = { item, product, photoUrl: null };
    }

    const bucket = entriesByCategory.get(item.category_id);
    if (bucket) bucket.push(entry);
    else entriesByCategory.set(item.category_id, [entry]);
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
