import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getServerUserProfile } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Whether the signed-in caller is the operator. Asks the database rather
 * than comparing the profile against a hardcoded email/phone list, which
 * is what this used to do — and those columns are self-editable under
 * users_update_own, so that list could be matched by anyone who rewrote
 * their own row (2026-11-12 security audit). is_admin_operator() now reads
 * public.admin_operators (20261112130000_admin_operators_table.sql), a
 * table no client role can read or write, and it is the same function
 * every admin_* RPC and the product-images storage policies already
 * call: one source of truth on both sides instead of two lists to drift.
 *
 * Also what SettingsScreen uses to decide whether to show a link into
 * /admin at all — the route has no other way to be found.
 *
 * cache()'d: requireAdminAccess and a page can both ask in one request.
 */
export const isAdminUser = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_admin_operator");
  return !error && data === true;
});

/** Redirects anyone but the admin straight back to /login, so the route
 * doesn't even hint at what it contains to someone who stumbles onto it
 * signed out or signed in as an ordinary user. */
export async function requireAdminAccess() {
  const profile = await getServerUserProfile();
  if (!profile || !(await isAdminUser())) {
    redirect("/login");
  }
  return profile;
}
