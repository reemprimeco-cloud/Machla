import { AdminDashboard } from "@/components/admin/AdminDashboard";
import {
  getAdminLapsedTrials,
  getAdminRecentSubscriptions,
  getAdminRecentUsers,
  getAdminStats,
  getAdminTodaySignups,
} from "@/lib/admin/queries";
import { requireAdminAccess } from "@/lib/admin/guard";

/**
 * The one page in this app that isn't scoped to a household — see
 * lib/admin/guard.ts for who can reach it, and
 * supabase/migrations/*_admin_stats.sql for how it sees past RLS.
 */
export default async function AdminPage() {
  await requireAdminAccess();
  const [stats, subscriptions, users, todaySignups, lapsedTrials] = await Promise.all([
    getAdminStats(),
    getAdminRecentSubscriptions(),
    getAdminRecentUsers(),
    getAdminTodaySignups(),
    getAdminLapsedTrials(),
  ]);

  if (!stats) {
    return (
      <main className="mx-auto flex w-full max-w-[var(--hl-content-max)] flex-1 flex-col gap-4 px-5 py-8">
        <p className="hl-body text-ink">Stats are not available right now.</p>
      </main>
    );
  }

  return (
    <AdminDashboard
      stats={stats}
      subscriptions={subscriptions}
      users={users}
      todaySignups={todaySignups}
      lapsedTrials={lapsedTrials}
    />
  );
}
