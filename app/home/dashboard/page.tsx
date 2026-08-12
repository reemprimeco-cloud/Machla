import { HouseholdDashboard } from "@/components/household/HouseholdDashboard";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";
import { getHouseholdLists, isOpen } from "@/lib/list/household";
import { getUnreadCount } from "@/lib/notifications/queries";

/** The currently-selected household's dashboard (see `app/home/page.tsx`
 * for the switcher that picks which one): incoming lists first, then the
 * people and invitation screens. */
export default async function DashboardPage() {
  const membership = await requireHouseholdAccess();

  const [members, lists, unreadCount] = await Promise.all([
    getHouseholdMembers(membership.householdId),
    getHouseholdLists(membership.householdId),
    getUnreadCount(),
  ]);

  return (
    <HouseholdDashboard
      householdName={membership.householdName}
      role={membership.role}
      memberCount={members.length}
      recentLists={lists.slice(0, 3)}
      openCount={lists.filter(isOpen).length}
      unreadCount={unreadCount}
    />
  );
}
