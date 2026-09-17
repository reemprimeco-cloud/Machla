import { redirect } from "next/navigation";

import { HomesSwitcher } from "@/components/household/HomesSwitcher";
import { getServerUserProfile } from "@/lib/auth/session";
import { getActiveMemberships } from "@/lib/household/queries";

/**
 * The front door for the owner/member experience: every household the
 * signed-in user belongs to, as a card — "My home", "My office", however
 * many they run. Tapping one sets it as current (`selectHouseholdAction`)
 * and opens `/home/dashboard`.
 *
 * A user with no owner/member household routes onward exactly like
 * `requireHouseholdAccess` would: to `/worker` if they have a worker
 * membership instead, to `/onboarding` if they have none at all. This
 * page has nothing to switch between in either case.
 *
 * Exactly one household is the common case, and there was nothing to
 * choose there either — the bottom tab bar's "Homes" tab always points
 * here (HomeTabBar.tsx), so every tap on it cost an extra "pick your one
 * household" screen before landing on the dashboard it always resolves
 * to anyway (`requireHouseholdAccess` already defaults to `homes[0]`
 * with no cookie set — 2026-09 feedback: "this back is quite wrong").
 * Skipping straight to the dashboard needs no `selectHouseholdAction`
 * call: there being only one home means there is nothing to select.
 */
export default async function HomesPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const memberships = await getActiveMemberships();
  const homes = memberships.filter((membership) => membership.role !== "worker");

  if (homes.length === 0) {
    if (memberships.length === 0) redirect("/onboarding");
    redirect("/worker");
  }
  if (homes.length === 1) redirect("/home/dashboard");

  return <HomesSwitcher homes={homes} />;
}
