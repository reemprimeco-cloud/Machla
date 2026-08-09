import { HouseholdDashboard } from "@/components/household/HouseholdDashboard";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";

/**
 * Household dashboard. Phase 7 turns this into the real lists view; for
 * now it is the entry point to the people and invitation screens that
 * Phase 4 delivers.
 */
export default async function HomePage() {
  const membership = await requireHouseholdAccess();
  const members = await getHouseholdMembers(membership.householdId);

  return (
    <HouseholdDashboard
      householdName={membership.householdName}
      role={membership.role}
      memberCount={members.length}
    />
  );
}
