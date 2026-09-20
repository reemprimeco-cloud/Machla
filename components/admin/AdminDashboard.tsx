import Link from "next/link";

import { AdminBroadcastForm } from "@/components/admin/AdminBroadcastForm";
import { ContactIcons } from "@/components/admin/ContactIcons";
import type {
  AdminLapsedTrialRow,
  AdminStats,
  AdminSubscriptionRow,
  AdminUserRow,
} from "@/lib/admin/queries";
import type { SubscriptionStatus } from "@/lib/supabase/database.types";

/** The nominal annual price (App Store Connect) — not stored anywhere
 * server-side, since Apple's status callback never carries an amount
 * (lib/subscription/apple.ts). Revenue below is therefore an estimate:
 * paid subscriber count × this constant, in USD, before Apple's cut and
 * before whatever a household's own country's App Store price actually
 * converts to. */
const ANNUAL_PRICE_USD = 16;

/** Plain, Arabic, no `t()` — this is an internal tool for the one person
 * who runs the service, not customer-facing UI, so it doesn't carry the
 * 12-language obligation the rest of the app has. */
function StatCard({
  label,
  value,
  tone = "surface",
}: {
  label: string;
  value: string | number;
  tone?: "primary" | "success" | "warning" | "danger" | "surface";
}) {
  const toneClass =
    tone === "primary"
      ? "bg-primary-tint"
      : tone === "success"
        ? "bg-success-tint"
        : tone === "warning"
          ? "bg-warning-tint"
          : tone === "danger"
            ? "bg-danger-tint"
            : "bg-surface-2";

  return (
    <div className={`rounded-lg p-4 shadow-sm ${toneClass}`}>
      <p className="hl-caption text-ink-muted">{label}</p>
      <p className="hl-title text-ink">{value}</p>
    </div>
  );
}

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  none: "تجربة مجانية",
  active: "نشط",
  grace_period: "فترة سماح",
  expired: "منتهي",
  revoked: "ملغى",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ar", { year: "numeric", month: "short", day: "numeric" });
}

export function AdminDashboard({
  stats,
  subscriptions,
  users,
  todaySignups,
  lapsedTrials,
}: {
  stats: AdminStats;
  subscriptions: AdminSubscriptionRow[];
  users: AdminUserRow[];
  todaySignups: AdminUserRow[];
  lapsedTrials: AdminLapsedTrialRow[];
}) {
  const activeUsers = stats.ownersAndMembers + stats.workers;
  const estimatedRevenue = stats.subscriptionsPaid * ANNUAL_PRICE_USD;

  return (
    <main dir="rtl" className="mx-auto flex w-full max-w-[var(--hl-content-max)] flex-1 flex-col gap-6 px-5 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="hl-title text-ink">لوحة تحكم Machla</h1>
          <p className="hl-caption">نظرة عامة على الاشتراكات والمستخدمين</p>
        </div>
        <Link
          href="/home/settings"
          className="hl-label rounded-lg border border-line bg-surface px-4 py-2 text-ink"
        >
          رجوع
        </Link>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <StatCard label="المشتركين المدفوعين" value={stats.subscriptionsPaid} tone="primary" />
        <StatCard label="المستخدمين الفعالين" value={activeUsers} tone="success" />
        <StatCard label="الإيرادات التقديرية" value={`$${estimatedRevenue.toLocaleString()}`} tone="warning" />
      </section>
      <p className="hl-caption -mt-3 text-ink-faint">
        الإيرادات تقديرية بسعر ${ANNUAL_PRICE_USD} سنوياً لكل اشتراك مدفوع فعلياً — لا تشمل عمولة آبل ولا فروقات العملة.
      </p>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">تفاصيل الاشتراكات</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="مجاني (بدون رسوم)" value={stats.subscriptionsComped} />
          <StatCard label="تجربة مجانية سارية" value={stats.subscriptionsTrialing} />
          <StatCard label="انتهت التجربة بدون اشتراك" value={stats.subscriptionsLapsed} />
          <StatCard label="اشتراك منتهي أو ملغى" value={stats.subscriptionsExpiredOrRevoked} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">التسجيلات</h2>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="سجّلوا اليوم" value={stats.newUsersToday} tone="primary" />
          <StatCard label="سجّلوا آخر 7 أيام" value={stats.newUsers7d} />
        </div>
        {todaySignups.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
            <table className="w-full text-right">
              <thead>
                <tr className="hl-caption border-b border-line text-ink-muted">
                  <th className="p-3 font-normal">الاسم</th>
                  <th className="p-3 font-normal">الجوال</th>
                  <th className="p-3 font-normal">الوقت</th>
                  <th className="p-3 font-normal">تواصل</th>
                </tr>
              </thead>
              <tbody>
                {todaySignups.map((user) => (
                  <tr key={user.id} className="hl-body border-b border-line last:border-0">
                    <td className="p-3 text-ink">{user.displayName ?? "—"}</td>
                    <td className="p-3">
                      <bdi dir="ltr" className="text-ink-muted">
                        {user.phoneNumber}
                      </bdi>
                    </td>
                    <td className="p-3 text-ink-muted">
                      {new Date(user.createdAt).toLocaleTimeString("ar", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="p-3">
                      <ContactIcons phone={user.phoneNumber} email={user.email} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="hl-caption text-ink-muted">محد سجّل اليوم لين الحين.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">التواصل</h2>
        <AdminBroadcastForm
          iosDeviceCount={stats.iosDeviceCount}
          lapsedHouseholdCount={stats.subscriptionsLapsed}
        />

        {/* The actual names/phones behind the "انتهت تجربتهم" push
            audience above and the "انتهت التجربة بدون اشتراك" stat card —
            most have no push enabled (only one, as of this writing), so
            WhatsApp/email are the real way to reach this list. */}
        <p className="hl-caption mt-3 text-ink-muted">انتهت تجربتهم المجانية</p>
        {lapsedTrials.length === 0 ? (
          <p className="hl-caption text-ink-muted">محد انتهت تجربته بدون اشتراك حالياً.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
            <table className="w-full text-right">
              <thead>
                <tr className="hl-caption border-b border-line text-ink-muted">
                  <th className="p-3 font-normal">البيت</th>
                  <th className="p-3 font-normal">المالك</th>
                  <th className="p-3 font-normal">الجوال</th>
                  <th className="p-3 font-normal">انتهت التجربة</th>
                  <th className="p-3 font-normal">تواصل</th>
                </tr>
              </thead>
              <tbody>
                {lapsedTrials.map((row) => (
                  <tr key={row.householdId} className="hl-body border-b border-line last:border-0">
                    <td className="p-3 text-ink">{row.householdName}</td>
                    <td className="p-3 text-ink">{row.ownerName ?? "—"}</td>
                    <td className="p-3">
                      <bdi dir="ltr" className="text-ink-muted">
                        {row.ownerPhone}
                      </bdi>
                    </td>
                    <td className="p-3 text-ink-muted">{formatDate(row.trialEndedAt)}</td>
                    <td className="p-3">
                      <ContactIcons phone={row.ownerPhone} email={row.ownerEmail} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">آخر الاشتراكات</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
          <table className="w-full text-right">
            <thead>
              <tr className="hl-caption border-b border-line text-ink-muted">
                <th className="p-3 font-normal">البيت</th>
                <th className="p-3 font-normal">المالك</th>
                <th className="p-3 font-normal">الجوال</th>
                <th className="p-3 font-normal">الحالة</th>
                <th className="p-3 font-normal">المبلغ</th>
                <th className="p-3 font-normal">آخر تحديث</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="hl-body p-4 text-center text-ink-muted">
                    لا يوجد اشتراكات بعد
                  </td>
                </tr>
              ) : (
                subscriptions.map((row) => (
                  <tr key={row.householdId} className="hl-body border-b border-line last:border-0">
                    <td className="p-3 text-ink">{row.householdName}</td>
                    <td className="p-3 text-ink">{row.ownerName ?? "—"}</td>
                    <td className="p-3">
                      <bdi dir="ltr" className="text-ink-muted">
                        {row.ownerPhone}
                      </bdi>
                    </td>
                    <td className="p-3 text-ink">{STATUS_LABELS[row.status]}</td>
                    <td className="p-3 text-ink">
                      {row.appleLinked ? `$${ANNUAL_PRICE_USD}` : "مجاني"}
                    </td>
                    <td className="p-3 text-ink-muted">{formatDate(row.updatedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">آخر المستخدمين المسجلين</h2>
        <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
          <table className="w-full text-right">
            <thead>
              <tr className="hl-caption border-b border-line text-ink-muted">
                <th className="p-3 font-normal">الاسم</th>
                <th className="p-3 font-normal">الجوال</th>
                <th className="p-3 font-normal">تاريخ التسجيل</th>
                <th className="p-3 font-normal">تواصل</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="hl-body border-b border-line last:border-0">
                  <td className="p-3 text-ink">{user.displayName ?? "—"}</td>
                  <td className="p-3">
                    <bdi dir="ltr" className="text-ink-muted">
                      {user.phoneNumber}
                    </bdi>
                  </td>
                  <td className="p-3 text-ink-muted">{formatDate(user.createdAt)}</td>
                  <td className="p-3">
                    <ContactIcons phone={user.phoneNumber} email={user.email} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
