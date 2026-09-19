import { HouseholdDashboard } from "@/components/household/HouseholdDashboard";
import { getServerUserProfile } from "@/lib/auth/session";
import { greetingKeyForNow } from "@/lib/household/greeting";
import { requireActiveSubscription, requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";
import { getHouseholdLists, isOpen } from "@/lib/list/household";
import { getDraftList } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/** The currently-selected household's dashboard (see `app/home/page.tsx`
 * for the switcher that picks which one): incoming lists first. People
 * and invitations live in Settings (app/home/settings/page.tsx).
 *
 * No categories fetch here (2026-09): the dashboard no longer previews
 * them — that grid only ever duplicated the one "My own list" itself
 * opens onto (app/home/shop).
 *
 * The caller's own draft (getDraftList — same query WorkerPage uses for
 * the worker's item badge) decides where "My own list" points: straight
 * into the review screen when there's already something on it, or the
 * categories grid to start one when there isn't (2026-09 feedback: don't
 * force a categories screen back onto someone who's already shopping). */
export default async function DashboardPage() {
  const membership = await requireHouseholdAccess();
  await requireActiveSubscription(membership);

  const [members, lists, unreadCount, profile, draft] = await Promise.all([
    getHouseholdMembers(membership.householdId),
    getHouseholdLists(membership.householdId),
    getUnreadCount(),
    getServerUserProfile(),
    getDraftList(membership.householdId),
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
      ownListItemCount={draft?.itemCount ?? 0}
      displayName={profile?.display_name ?? null}
      greetingKey={greetingKeyForNow()}
      accountCompleted={Boolean(profile?.account_completed_at)}
    />
  );
}
