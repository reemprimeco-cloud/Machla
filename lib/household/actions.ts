"use server";

import { revalidatePath } from "next/cache";

import { setSelectedHouseholdId } from "./currentHousehold";
import type { ActionResult } from "./errors";
import { toHouseholdErrorCode } from "./errors";
import { getActiveMemberships } from "./queries";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Server Actions wrapping the Phase 4 RPCs.
 *
 * Authorization is NOT performed here — it lives inside each SECURITY
 * DEFINER function in Postgres, which checks auth.uid() against
 * household_members (docs/architecture/10-security-model.md §1). That
 * matters because Server Actions are reachable as plain POSTs to the
 * route they're used on; putting the check in the database means an
 * attacker calling one directly gets exactly the same refusal a UI
 * caller would.
 */

interface PreviewResult {
  householdName: string;
  role: "member" | "worker";
}

/** Sets the caller's own display name. Covered by the `users_update_own`
 * RLS policy from the Phase 1 migration — no RPC needed. Best-effort:
 * a failure here must not block joining or creating a household. */
async function setDisplayName(displayName: string | undefined): Promise<void> {
  const trimmed = displayName?.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("users")
    .update({ display_name: trimmed.slice(0, 80), updated_at: new Date().toISOString() })
    .eq("id", user.id);
}

export async function createHouseholdAction(
  name: string,
  displayName?: string,
): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  await setDisplayName(displayName);

  const { data, error } = await supabase.rpc("create_household", { p_name: name });

  if (error || !data) {
    return { ok: false, code: toHouseholdErrorCode(error?.message) };
  }

  revalidatePath("/", "layout");
  return { ok: true, value: data };
}

export async function previewInvitationAction(
  code: string,
): Promise<ActionResult<PreviewResult | null>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("preview_invitation", { p_code: code });

  if (error) return { ok: false, code: toHouseholdErrorCode(error.message) };

  const row = data?.[0];
  // Zero rows is the deliberate response to an invalid, expired, revoked
  // or already-used code — the RPC does not distinguish between them
  // (docs/architecture/07-invitation-flow.md §4).
  if (!row) return { ok: true, value: null };

  return { ok: true, value: { householdName: row.household_name, role: row.role } };
}

export async function acceptInvitationAction(
  code: string,
  displayName?: string,
): Promise<ActionResult<string>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  await setDisplayName(displayName);

  const { data, error } = await supabase.rpc("accept_invitation", { p_code: code });

  if (error || !data) {
    return { ok: false, code: toHouseholdErrorCode(error?.message) };
  }

  revalidatePath("/", "layout");
  return { ok: true, value: data };
}

export async function createInvitationAction(
  householdId: string,
  role: "member" | "worker",
): Promise<ActionResult<{ code: string; expiresAt: string }>> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_household_id: householdId,
    p_role: role,
  });

  const row = data?.[0];
  if (error || !row) {
    return { ok: false, code: toHouseholdErrorCode(error?.message) };
  }

  revalidatePath("/home/invitations");
  return { ok: true, value: { code: row.code, expiresAt: row.expires_at } };
}

export async function revokeInvitationAction(invitationId: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: invitationId });

  if (error) return { ok: false, code: toHouseholdErrorCode(error.message) };

  revalidatePath("/home/invitations");
  return { ok: true, value: undefined };
}

export async function removeMemberAction(
  householdId: string,
  userId: string,
): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_household_member", {
    p_household_id: householdId,
    p_user_id: userId,
  });

  if (error) return { ok: false, code: toHouseholdErrorCode(error.message) };

  revalidatePath("/home/members");
  return { ok: true, value: undefined };
}

/**
 * Switches which household the owner/member experience shows — called
 * from a card on the Homes switcher (`app/home/page.tsx`).
 *
 * Re-validates the id against the caller's own active memberships before
 * writing the cookie. Not because the cookie grants anything by itself —
 * every downstream query is RLS-scoped regardless
 * (docs/architecture/10-security-model.md §1) — but so a forged or stale
 * id can't even cosmetically select a household the user has no access
 * to; it silently falls through to whatever `requireHouseholdAccess`
 * would have picked anyway.
 *
 * Deliberately does not redirect itself (unlike most other actions in
 * this file): it's called directly from a client event handler
 * (HomesSwitcher.tsx) that needs to show pending state while this runs
 * and navigate only after it resolves — a `redirect()` thrown from in
 * here would unwind through that handler's own try/catch and get
 * mistaken for a real failure.
 */
export async function selectHouseholdAction(householdId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const memberships = await getActiveMemberships();
  const isOwnerOrMember = memberships.some(
    (membership) => membership.householdId === householdId && membership.role !== "worker",
  );
  if (isOwnerOrMember) await setSelectedHouseholdId(householdId);
}
