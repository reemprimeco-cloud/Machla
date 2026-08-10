"use server";

import { revalidatePath } from "next/cache";

import { toListErrorCode, type ListActionResult } from "./errors";
import type { PurchaseStatus } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions wrapping the Phase 6 RPCs.
 *
 * As in Phase 4, authorization is NOT performed here — it lives inside
 * each SECURITY DEFINER function, which checks auth.uid() against
 * household_members and against the list's own created_by_user_id
 * (docs/architecture/10-security-model.md §1). A Server Action is
 * reachable as a plain POST to whatever route it is used on, so an
 * attacker calling one directly must get exactly the refusal a UI caller
 * would — and does, because the check is in Postgres.
 *
 * Note what is absent from this file: any way to set purchase_status,
 * purchased_at, or purchased_by_user_id. No worker-reachable RPC accepts
 * them (approved Phase 0 decision 6).
 */

/**
 * Sets how many of a product the caller wants, creating the draft on the
 * first add.
 *
 * One action rather than separate add/update/remove calls, because the
 * quantity stepper is one control: the browse screens never have to know
 * whether a draft exists yet or whether this product is already on it.
 *
 * A quantity of zero removes the item — that is what pressing "−" down to
 * nothing means to the person using it. The RPC itself still rejects a
 * zero quantity; the translation from "zero" to "remove" belongs here, in
 * the UI layer, not in the database's validation rules.
 */
export async function setProductQuantityAction(
  householdId: string,
  productId: string,
  quantity: number,
  language = "en",
): Promise<ListActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();

  const { data: listId, error: draftError } = await supabase.rpc("get_or_create_draft_list", {
    p_household_id: householdId,
    p_language: language,
  });

  if (draftError || !listId) {
    return { ok: false, code: toListErrorCode(draftError?.message) };
  }

  const { error } =
    quantity <= 0
      ? await supabase.rpc("remove_list_item", { p_list_id: listId, p_product_id: productId })
      : await supabase.rpc("set_list_item", {
          p_list_id: listId,
          p_product_id: productId,
          p_quantity: quantity,
        });

  if (error) return { ok: false, code: toListErrorCode(error.message) };

  revalidatePath("/worker", "layout");
  return { ok: true, value: listId };
}

export async function removeFromListAction(
  listId: string,
  productId: string,
): Promise<ListActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_list_item", {
    p_list_id: listId,
    p_product_id: productId,
  });

  if (error) return { ok: false, code: toListErrorCode(error.message) };

  revalidatePath("/worker", "layout");
  return { ok: true, value: undefined };
}

export async function sendListAction(listId: string): Promise<ListActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_list", { p_list_id: listId });

  if (error || !data) return { ok: false, code: toListErrorCode(error?.message) };

  revalidatePath("/worker", "layout");
  return { ok: true, value: data };
}

// ---- household side (Phase 7) --------------------------------------

/**
 * Marks a received list as seen. Called when the owner opens it.
 *
 * Best-effort by design: failing to record "viewed" must never stop the
 * list rendering. The RPC is idempotent and only ever moves sent →
 * viewed, so re-opening a completed list cannot walk its status back.
 */
export async function markListViewedAction(listId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = await createClient();
  await supabase.rpc("mark_list_viewed", { p_list_id: listId });
}

/**
 * Checks an item off, marks it unavailable, or clears it again.
 *
 * The only write path into purchase state in the whole system. It refuses
 * a Worker caller in Postgres, so the fact that this action is only
 * rendered on household screens is presentation, not protection.
 */
export async function setPurchaseStatusAction(
  itemId: string,
  status: PurchaseStatus,
): Promise<ListActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_purchase_status", {
    p_item_id: itemId,
    p_status: status,
  });

  if (error) return { ok: false, code: toListErrorCode(error.message) };

  revalidatePath("/home", "layout");
  return { ok: true, value: undefined };
}

/** Closes a shop, or reopens one closed by mistake. Deliberately allowed
 * with items still outstanding — a shop can finish with something
 * unavailable, and refusing would only teach people to fake the boxes. */
export async function setListCompletedAction(
  listId: string,
  completed: boolean,
): Promise<ListActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_list_completed", {
    p_list_id: listId,
    p_completed: completed,
  });

  if (error) return { ok: false, code: toListErrorCode(error.message) };

  revalidatePath("/home", "layout");
  return { ok: true, value: undefined };
}
