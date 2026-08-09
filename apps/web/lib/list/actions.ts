"use server";

import { revalidatePath } from "next/cache";

import { toListErrorCode, type ListActionResult } from "./errors";
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
