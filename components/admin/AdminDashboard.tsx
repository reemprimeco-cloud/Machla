import type { AdminStats } from "@/lib/admin/queries";

/** Plain, English-only, no `t()` — this is an internal tool for the one
 * person who runs the service, not customer-facing UI, so it doesn't
 * carry the 12-language obligation the rest of the app has. */
function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4 shadow-sm">
      <p className="hl-caption text-ink-muted">{label}</p>
      <p className="hl-title text-ink">{value}</p>
    </div>
  );
}

export function AdminDashboard({ stats }: { stats: AdminStats }) {
  return (
    <main className="mx-auto flex w-full max-w-[var(--hl-content-max)] flex-1 flex-col gap-6 px-5 py-8">
      <header>
        <h1 className="hl-title text-ink">Admin</h1>
        <p className="hl-caption">Machla, across every household.</p>
      </header>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">Households</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Households" value={stats.households} />
          <StatCard label="Total accounts" value={stats.totalUsers} />
          <StatCard label="Owners & members" value={stats.ownersAndMembers} />
          <StatCard label="Workers" value={stats.workers} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">Lists</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Draft" value={stats.listsDraft} />
          <StatCard label="Sent" value={stats.listsSent} />
          <StatCard label="Viewed" value={stats.listsViewed} />
          <StatCard label="Completed" value={stats.listsCompleted} />
          <StatCard label="Archived" value={stats.listsArchived} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">Growth</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="New accounts (7 days)" value={stats.newUsers7d} />
        </div>
      </section>
    </main>
  );
}
