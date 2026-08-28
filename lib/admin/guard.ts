import "server-only";

import { redirect } from "next/navigation";

import { getServerUserProfile } from "@/lib/auth/session";

/**
 * The one operator of this service today. A real admin-role system
 * (who can grant it, an audit log, more than one operator) is a bigger
 * feature to build only if a second admin is ever actually needed —
 * see supabase/migrations/*_admin_stats.sql for the same reasoning on
 * the database side, which is the gate that actually matters: this
 * check is defense-in-depth, not the primary control
 * (docs/architecture/10-security-model.md §1).
 */
const ADMIN_PHONE_NUMBERS = ["96565068000"];

/** Redirects anyone but the admin straight back to /login, so the route
 * doesn't even hint at what it contains to someone who stumbles onto it
 * signed out or signed in as an ordinary user. */
export async function requireAdminAccess() {
  const profile = await getServerUserProfile();
  if (!profile || !ADMIN_PHONE_NUMBERS.includes(profile.phone_number)) {
    redirect("/login");
  }
  return profile;
}
