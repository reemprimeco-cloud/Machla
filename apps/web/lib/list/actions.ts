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

/**
 * Returns the caller's open draft for a household, creating it if there
 * is none.
 *
 * Exists for the photo flow specifically: the object path contains the
 * list id, so the draft has to exist BEFORE the upload, not after it as
 * with a product add. The RPC is idempotent — one open draft per person
 * per household — so calling it on every capture is safe.
 */
export async function ensureDraftAction(
  householdId: string,
  language = "en",
): Promise<ListActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_or_create_draft_list", {
    p_household_id: householdId,
    p_language: language,
  });

  if (error || !data) return { ok: false, code: toListErrorCode(error?.message) };
  return { ok: true, value: data };
}

/**
 * Adds a photographed item to the caller's own draft.
 *
 * The upload itself happens in the browser, straight into the private
 * bucket, because the service role key is not — and must not be — in this
 * app's environment. That is safe because the storage policy authorizes
 * the write by the household id in the object path.
 *
 * This RPC then re-checks the FULL prefix (household AND list), which the
 * storage policy cannot: it never sees which list the object was meant
 * for. Both halves are needed.
 */
export async function addPhotoItemAction(
  listId: string,
  photoPath: string,
  quantity: number,
  note: string | null,
): Promise<ListActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_photo_item", {
    p_list_id: listId,
    p_photo_path: photoPath,
    p_quantity: quantity,
    p_note: note,
  });

  if (error || !data) return { ok: false, code: toListErrorCode(error?.message) };

  revalidatePath("/worker", "layout");
  return { ok: true, value: data };
}

/** Removes a photographed item. Keyed by item id, because a photographed
 * item has no product id for removeFromListAction to match on. */
export async function removePhotoItemAction(itemId: string): Promise<ListActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_photo_item", { p_item_id: itemId });

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

  // A photograph exists to answer "is this the thing you meant?". Ticking
  // the item off settles that, so the picture is purged now rather than
  // lingering. Best-effort: a failed purge must not make the tick fail,
  // because the checklist is what the person is actually doing. Anything
  // missed is swept up when the list is completed.
  if (status === "purchased") await purgePhotoFor(itemId);

  revalidatePath("/home", "layout");
  return { ok: true, value: undefined };
}

/**
 * Deletes the blob and stamps the row.
 *
 * The delete goes through the Storage API rather than SQL because
 * Supabase forbids `delete from storage.objects` outright; it runs with
 * the caller's session, so the storage policy authorizes it against the
 * same household membership as everything else.
 */
async function purgePhotoFor(itemId: string): Promise<void> {
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("shopping_list_items")
    .select("photo_path, photo_deleted_at")
    .eq("id", itemId)
    .maybeSingle();

  if (!item?.photo_path || item.photo_deleted_at) return;

  await supabase.storage.from("list-photos").remove([item.photo_path]);
  await supabase.rpc("mark_photo_purged", { p_item_id: itemId });
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

  // The sweep. Purging on purchase covers the normal path, but an item
  // marked unavailable — or one whose purge failed on a flaky connection
  // — would otherwise keep its photograph forever. Completing the list is
  // the point at which no photograph on it has any remaining purpose.
  if (completed) await purgePhotosForList(listId);

  revalidatePath("/home", "layout");
  return { ok: true, value: undefined };
}

/** Purges every photograph still present on a list. */
async function purgePhotosForList(listId: string): Promise<void> {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("shopping_list_items")
    .select("id, photo_path, photo_deleted_at")
    .eq("list_id", listId)
    .not("photo_path", "is", null)
    .is("photo_deleted_at", null);

  const paths = (items ?? [])
    .map((item) => item.photo_path)
    .filter((path): path is string => path !== null);
  if (paths.length === 0) return;

  await supabase.storage.from("list-photos").remove(paths);
  for (const item of items ?? []) {
    await supabase.rpc("mark_photo_purged", { p_item_id: item.id });
  }
}
