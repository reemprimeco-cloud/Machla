import { HouseholdDashboard } from "@/components/household/HouseholdDashboard";
import { getServerUserProfile } from "@/lib/auth/session";
import { greetingKeyForNow } from "@/lib/household/greeting";
import { requireActiveSubscription, requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";
import { getHouseholdLists, isOpen } from "@/lib/list/household";
import { getUnreadCount } from "@/lib/notifications/queries";

/** The currently-selected household's dashboard (see `app/home/page.tsx`
 * for the switcher that picks which one): incoming lists first. People
 * and invitations live in Settings (app/home/settings/page.tsx).
 *
 * No categories fetch here (2026-09): the dashboard no longer previews
 * them — that grid only ever duplicated the one "My own list" itself
 * opens onto (app/home/shop). */
export default async function DashboardPage() {
  const membership = await requireHouseholdAccess();
  await requireActiveSubscription(membership);

  const [members, lists, unreadCount, profile] = await Promise.all([
    getHouseholdMembers(membership.householdId),
    getHouseholdLists(membership.householdId),
    getUnreadCount(),
    getServerUserProfile(),
  ]);

  return (
    <HouseholdDashboard
      householdId={membership.householdId}
      householdName={membership.householdName}
      hasWorker={members.some((member) => member.role === "worker")}
      memberCount={members.length}
      recentLists={lists.slice(0, 3)}
      openCount={lists.filter(isOpen).length}
      unreadCount={unreadCount}
      displayName={profile?.display_name ?? null}
      greetingKey={greetingKeyForNow()}
    />
  );
}
