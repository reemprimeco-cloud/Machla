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

  return <HomesSwitcher homes={homes} />;
}
