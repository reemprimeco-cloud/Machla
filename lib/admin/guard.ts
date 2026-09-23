import "server-only";

import { redirect } from "next/navigation";

import { getServerUserProfile } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/database.types";

type UserRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * The one operator of this service today. A real admin-role system
 * (who can grant it, an audit log, more than one operator) is a bigger
 * feature to build only if a second admin is ever actually needed —
 * see is_admin_operator() (20260923120000_admin_country_and_feedback.sql)
 * for the same reasoning on the database side, which is the gate that
 * actually matters: this check is defense-in-depth, not the primary
 * control (docs/architecture/10-security-model.md §1).
 *
 * Email, not phone: Phase 2 of removing OTP
 * (20260920110000_phone_optional_identity.sql) means a brand-new
 * account — the admin's own included — may never have a phone number at
 * all. The original phone stays as a fallback rather than being dropped,
 * so the operator's original account keeps working if it's ever used to
 * sign in again.
 */
const ADMIN_PHONE_NUMBERS = ["96565068000"];
const ADMIN_EMAILS = ["reemprimeco@gmail.com"];

/** Whether an account is the admin's — also used by SettingsScreen to
 * decide whether to show a link into /admin at all, since the route has
 * no other way to be found: no in-app browser address bar to type it
 * into, and (deliberately) no nav item anyone else would ever see. */
export function isAdminUser(profile: Pick<UserRow, "phone_number" | "email">): boolean {
  return (
    (profile.phone_number !== null && ADMIN_PHONE_NUMBERS.includes(profile.phone_number)) ||
    (profile.email !== null && ADMIN_EMAILS.includes(profile.email.toLowerCase()))
  );
}

/** Redirects anyone but the admin straight back to /login, so the route
 * doesn't even hint at what it contains to someone who stumbles onto it
 * signed out or signed in as an ordinary user. */
export async function requireAdminAccess() {
  const profile = await getServerUserProfile();
  if (!profile || !isAdminUser(profile)) {
    redirect("/login");
  }
  return profile;
}
