import { HouseholdDashboard } from "@/components/household/HouseholdDashboard";
import { getServerUserProfile } from "@/lib/auth/session";
import { getCategories } from "@/lib/catalog/queries";
import { greetingKeyForNow } from "@/lib/household/greeting";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";
import { getHouseholdLists, isOpen } from "@/lib/list/household";
import { getUnreadCount } from "@/lib/notifications/queries";

/** The currently-selected household's dashboard (see `app/home/page.tsx`
 * for the switcher that picks which one): incoming lists first, then the
 * people and invitation screens. */
export default async function DashboardPage() {
  const membership = await requireHouseholdAccess();

  const [members, lists, unreadCount, categories, profile] = await Promise.all([
    getHouseholdMembers(membership.householdId),
    getHouseholdLists(membership.householdId),
    getUnreadCount(),
    getCategories(),
    getServerUserProfile(),
  ]);

  return (
    <HouseholdDashboard
      householdName={membership.householdName}
      role={membership.role}
      memberCount={members.length}
      recentLists={lists.slice(0, 3)}
      openCount={lists.filter(isOpen).length}
      unreadCount={unreadCount}
      categories={categories}
      displayName={profile?.display_name ?? null}
      greetingKey={greetingKeyForNow()}
    />
  );
}
