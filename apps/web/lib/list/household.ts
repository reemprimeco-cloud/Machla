import "server-only";

import { getCategories } from "@/lib/catalog/queries";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

import { groupEntries, signPhotoPaths, type ListGroup } from "./queries";

/**
 * The household's view of received lists.
 *
 * Separate from queries.ts (the author's view) because the two sides read
 * different things: the author reads their own draft; the household reads
 * every *sent* list, plus who sent it and how far the shopping has got.
 */

export type HouseholdList =
  Database["public"]["Functions"]["get_household_lists"]["Returns"][number];

export interface ListDetail {
  summary: HouseholdList;
  groups: ListGroup[];
}

/**
 * Lists the household has received, newest first.
 *
 * Goes through the `get_household_lists` RPC rather than selecting from
 * `shopping_lists` directly, for one reason that matters: `users` is
 * scoped by RLS to the caller's own row, so a plain query cannot resolve
 * who sent a list — and "the owner can identify exactly which worker sent
 * each list" is the Phase 7 acceptance criterion. The RPC is the narrow,
 * membership-checked place that can, and it returns display_name only,
 * never a phone number.
 */
export async function getHouseholdLists(householdId: string): Promise<HouseholdList[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_household_lists", {
    p_household_id: householdId,
  });

  if (error) return [];
  return data ?? [];
}

/** One received list, with its items grouped by category exactly as the
 * worker sent them. */
export async function getHouseholdListDetail(
  householdId: string,
  listId: string,
): Promise<ListDetail | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();

  const { data: summaries, error } = await supabase.rpc("get_household_lists", {
    p_household_id: householdId,
    p_list_id: listId,
  });

  const summary = summaries?.[0];
  if (error || !summary) return null;

  const [{ data: items }, categories] = await Promise.all([
    supabase
      .from("shopping_list_items")
      .select("*")
      .eq("list_id", listId)
      .order("sort_order", { ascending: true }),
    getCategories(),
  ]);

  if (!items || items.length === 0) return { summary, groups: [] };

  const productIds = [...new Set(items.map((item) => item.product_id))].filter(
    (id): id is string => id !== null,
  );
  const { data: products } = productIds.length
    ? await supabase.from("products").select("*").in("id", productIds)
    : { data: [] };
  const productById = new Map((products ?? []).map((product) => [product.id, product]));

  // Signed the same way as on the worker's side, with this caller's own
  // client — so the household reads the photograph only because they are
  // an active member, by the same rule that lets them read the list.
  const photoUrlByPath = await signPhotoPaths(items);

  // The same grouping function the worker's own review screen uses, so
  // the two sides cannot drift: what the owner shops from is what the
  // worker saw before sending (§16A.1).
  return { summary, groups: groupEntries(items, productById, categories, photoUrlByPath) };
}

/** Item-count progress, never quantity-weighted: ten units of one product
 * is one checklist item (master plan §16A.6). */
export function progressPercent(list: Pick<HouseholdList, "total_items" | "purchased_items">): number {
  if (!list.total_items) return 0;
  return Math.round((Number(list.purchased_items) / Number(list.total_items)) * 100);
}

/** A list still needing attention — what the dashboard counts. */
export function isOpen(list: Pick<HouseholdList, "status">): boolean {
  return list.status === "sent" || list.status === "viewed";
}
