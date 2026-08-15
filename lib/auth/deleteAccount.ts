"use server";

import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/household/errors";
import { toHouseholdErrorCode } from "@/lib/household/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Self-service account deletion — Apple Guideline 5.1.1(v): an app that
 * lets someone create an account must let them delete it from inside
 * the app, and it must be a real deletion, not a deactivation.
 *
 * Two privilege levels, deliberately kept apart:
 *
 *   1. `delete_own_account()` runs with the CALLER's own session. It can
 *      only ever see and touch what that session's RLS already allows —
 *      which is the entire point: nothing here trusts this Server
 *      Action's own judgement about what the caller is allowed to
 *      delete, the database re-derives it from auth.uid() same as every
 *      other write path in this app (docs/architecture/10-security-model.md).
 *      It deletes every household the caller owns (which cascades their
 *      members, lists, items and invitations with it — the owner
 *      decision behind this feature: a household never outlives being
 *      deleted by proxy, it is deleted directly and completely) and
 *      hands back the photo paths that went with them.
 *
 *   2. Only the actual `auth.users` row deletion needs elevated
 *      privilege — there is no self-service "delete my own auth
 *      account" call, only `auth.admin.deleteUser`, which requires the
 *      service role (`lib/supabase/admin.ts`). That row's deletion
 *      cascades to `public.users` and, from there, to every table that
 *      still referenced the caller (household_members, notifications,
 *      push_subscriptions — see 20260814120000_account_deletion.sql for
 *      the full cascade picture).
 *
 * Order matters: the RLS-scoped step runs FIRST, while the caller is
 * still a real, authenticated member of whatever they're about to lose —
 * the admin step that follows invalidates their session, so nothing
 * after it could be authorized by RLS even if it tried.
 */
export async function deleteAccountAction(): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  // Checked BEFORE anything is deleted, on purpose. The household
  // deletion below is irreversible; finding out only afterward that
  // SUPABASE_SERVICE_ROLE_KEY was never added to the environment would
  // mean a caller whose "delete my account" failed still lost their
  // household as a side effect of that failure. Nothing is touched
  // unless the whole operation can actually complete.
  const admin = createAdminClient();
  if (!admin) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "AUTH_REQUIRED" };

  const { data: rows, error } = await supabase.rpc("delete_own_account");
  if (error) return { ok: false, code: toHouseholdErrorCode(error.message) };

  const paths = (rows ?? [])
    .map((row) => row.photo_path)
    .filter((path): path is string => Boolean(path));

  // Best-effort: an orphaned blob in a bucket nobody can reach through
  // the app again is a cleanup task, not a reason to leave the caller
  // holding an account they just asked to delete.
  if (paths.length > 0) {
    await admin.storage.from("list-photos").remove(paths).catch(() => {});
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  // A failure here is the one outcome this action cannot silently
  // swallow: the household is already gone, so returning "ok" while the
  // auth account survives would strand the caller in a state nothing in
  // the UI expects — signed in, but ownerless and list-less. Surface it
  // as UNKNOWN rather than pretend success.
  if (deleteError) return { ok: false, code: "UNKNOWN" };

  await supabase.auth.signOut();
  redirect("/welcome");
}
