"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AdminBroadcastForm } from "@/components/admin/AdminBroadcastForm";
import { ContactIcons } from "@/components/admin/ContactIcons";
import { Card } from "@/components/ui/Primitives";
import type {
  AdminCountryRow,
  AdminFeedbackRow,
  AdminLapsedTrialRow,
  AdminStats,
  AdminSubscriptionRow,
  AdminUserRow,
} from "@/lib/admin/queries";
import { countryLabel } from "@/lib/i18n/countries";
import { createClient } from "@/lib/supabase/client";
import type { SubscriptionStatus } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

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

/** One numbered row in the list-pipeline mini chart (Overview tab) — a
 * label, a proportional bar, and the raw count, sharing one `max` so the
 * five bars are readable against each other rather than each against its
 * own scale. */
function PipelineRow({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="hl-caption w-20 shrink-0 text-ink-muted">{label}</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-2">
        <div className="h-full rounded-pill bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="hl-caption w-8 shrink-0 text-end tabular-nums text-ink-muted">{value}</span>
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

function TableCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="hl-label text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

const TABS = [
  { key: "overview", label: "نظرة عامة" },
  { key: "signups", label: "التسجيلات" },
  { key: "subscriptions", label: "الاشتراكات" },
  { key: "outreach", label: "التواصل" },
  { key: "feedback", label: "الملاحظات" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function AdminDashboard({
  stats,
  subscriptions,
  users,
  todaySignups,
  lapsedTrials,
  countryStats,
  feedback,
}: {
  stats: AdminStats;
  subscriptions: AdminSubscriptionRow[];
  users: AdminUserRow[];
  todaySignups: AdminUserRow[];
  lapsedTrials: AdminLapsedTrialRow[];
  countryStats: AdminCountryRow[];
  feedback: AdminFeedbackRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeUsers = stats.ownersAndMembers + stats.workers;
  const estimatedRevenue = stats.subscriptionsPaid * ANNUAL_PRICE_USD;
  const inFlightMax = Math.max(stats.listsDraft, stats.listsSent, stats.listsViewed, 1);

  function handleRefresh() {
    setRefreshing(true);
    router.refresh();
    // No signal from router.refresh() itself for when the re-render
    // lands — this is purely so the button doesn't look inert on a tap.
    setTimeout(() => setRefreshing(false), 600);
  }

  async function handleLogout() {
    setSigningOut(true);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main dir="rtl" className="min-h-full bg-bg">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="hl-title text-ink">لوحة تحكم Machla</h1>
            <span className="hl-caption rounded-pill bg-success-tint px-3 py-1 text-success">
              {stats.households} بيت مسجّل
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="hl-label rounded-lg border border-line bg-surface px-4 py-2 text-ink disabled:opacity-60"
            >
              {refreshing ? "جارٍ التحديث…" : "تحديث الأرقام"}
            </button>
            <Link
              href="/home/settings"
              className="hl-label rounded-lg border border-line bg-surface px-4 py-2 text-ink"
            >
              رجوع
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="hl-label rounded-lg border border-danger px-4 py-2 text-danger disabled:opacity-60"
            >
              خروج
            </button>
          </div>
        </header>

        {/* The persistent KPI row — stays visible whatever tab is open,
            same as the reference layout's top row (2026-09 request). */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="مشتركين مدفوعين" value={stats.subscriptionsPaid} tone="primary" />
          <StatCard label="مستخدمين فعالين" value={activeUsers} tone="success" />
          <StatCard label="سجّلوا اليوم" value={stats.newUsersToday} tone="warning" />
          <StatCard label="بيوت مسجّلة" value={stats.households} />
        </section>

        {/* Pill tab nav. */}
        <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`hl-label shrink-0 rounded-pill px-4 py-2 transition-colors duration-150 ease-hl ${
                tab === key
                  ? "bg-primary text-on-primary"
                  : "border border-line bg-surface text-ink-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "overview" ? (
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
            <TableCard title="تفاصيل الاشتراكات">
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="مجاني (بدون رسوم)" value={stats.subscriptionsComped} />
                <StatCard label="تجربة مجانية سارية" value={stats.subscriptionsTrialing} />
                <StatCard label="انتهت التجربة بدون اشتراك" value={stats.subscriptionsLapsed} />
                <StatCard label="اشتراك منتهي أو ملغى" value={stats.subscriptionsExpiredOrRevoked} />
              </div>
              <div className="rounded-lg bg-warning-tint p-4 shadow-sm">
                <p className="hl-caption text-ink-muted">الإيرادات التقديرية</p>
                <p className="hl-title text-ink">${estimatedRevenue.toLocaleString()}</p>
                <p className="hl-caption mt-1 text-ink-faint">
                  بسعر ${ANNUAL_PRICE_USD} سنوياً لكل اشتراك مدفوع فعلياً — لا تشمل عمولة آبل ولا
                  فروقات العملة.
                </p>
              </div>
            </TableCard>

            <TableCard title="نشاط القوائم">
              {/* Draft/sent/viewed are a snapshot of what's in flight
                  right now; completed/archived are lifetime totals of
                  lists that finished. Sharing one bar scale across both
                  kinds made the chart meaningless — a few hundred lists
                  ever completed dwarfs a handful open today — so only
                  the in-flight three compare against each other, and the
                  two lifetime totals sit beside them as plain numbers. */}
              <Card className="space-y-2.5">
                <p className="hl-caption text-ink-muted">قوائم مفتوحة الآن</p>
                <PipelineRow label="مسودّة" value={stats.listsDraft} max={inFlightMax} />
                <PipelineRow label="مُرسلة" value={stats.listsSent} max={inFlightMax} />
                <PipelineRow label="مفتوحة" value={stats.listsViewed} max={inFlightMax} />
              </Card>
              <div className="grid grid-cols-2 gap-3">
                <StatCard label="أُنجزت (كل الوقت)" value={stats.listsCompleted} tone="success" />
                <StatCard label="أُرشفت (كل الوقت)" value={stats.listsArchived} />
              </div>
            </TableCard>
          </div>
        ) : null}

        {tab === "signups" ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-2 gap-3 sm:w-fit sm:grid-cols-2">
              <StatCard label="سجّلوا اليوم" value={stats.newUsersToday} tone="primary" />
              <StatCard label="سجّلوا آخر 7 أيام" value={stats.newUsers7d} />
            </div>

            <TableCard title="التسجيلات حسب الدولة">
              {countryStats.length === 0 ? (
                <p className="hl-caption text-ink-muted">ما فيه بيانات دول بعد.</p>
              ) : (
                <div className="grid gap-1.5 rounded-lg border border-line bg-surface p-4 shadow-sm lg:grid-cols-2 lg:gap-x-8">
                  {countryStats.map((row) => {
                    const max = countryStats[0]?.signups || 1;
                    const percent = Math.round((row.signups / max) * 100);
                    return (
                      <div key={row.countryCode ?? "—"} className="flex items-center gap-3">
                        <span className="hl-body w-40 shrink-0 truncate text-ink" title={row.countryCode ? countryLabel(row.countryCode, "ar") : "غير محدد"}>
                          {row.countryCode ? countryLabel(row.countryCode, "ar") : "غير محدد"}
                        </span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-pill bg-surface-2">
                          <div
                            className="h-full rounded-pill bg-primary"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="hl-caption w-8 shrink-0 text-end tabular-nums text-ink-muted">
                          {row.signups}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </TableCard>

            <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
              <TableCard title="سجّلوا اليوم">
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
                                {user.phoneNumber ?? "—"}
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
              </TableCard>

              <TableCard title="آخر المستخدمين المسجلين">
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
                              {user.phoneNumber ?? "—"}
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
              </TableCard>
            </div>
          </div>
        ) : null}

        {tab === "subscriptions" ? (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <TableCard title="آخر الاشتراكات">
              <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
                <table className="w-full text-right">
                  <thead>
                    <tr className="hl-caption border-b border-line text-ink-muted">
                      <th className="p-3 font-normal">البيت</th>
                      <th className="p-3 font-normal">المالك</th>
                      <th className="p-3 font-normal">الحالة</th>
                      <th className="p-3 font-normal">المبلغ</th>
                      <th className="p-3 font-normal">آخر تحديث</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="hl-body p-4 text-center text-ink-muted">
                          لا يوجد اشتراكات بعد
                        </td>
                      </tr>
                    ) : (
                      subscriptions.map((row) => (
                        <tr key={row.householdId} className="hl-body border-b border-line last:border-0">
                          <td className="p-3 text-ink">{row.householdName}</td>
                          <td className="p-3 text-ink">{row.ownerName ?? "—"}</td>
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
            </TableCard>

            <TableCard title="انتهت تجربتهم المجانية">
              {lapsedTrials.length === 0 ? (
                <p className="hl-caption text-ink-muted">محد انتهت تجربته بدون اشتراك حالياً.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-line bg-surface shadow-sm">
                  <table className="w-full text-right">
                    <thead>
                      <tr className="hl-caption border-b border-line text-ink-muted">
                        <th className="p-3 font-normal">البيت</th>
                        <th className="p-3 font-normal">المالك</th>
                        <th className="p-3 font-normal">انتهت التجربة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lapsedTrials.map((row) => (
                        <tr key={row.householdId} className="hl-body border-b border-line last:border-0">
                          <td className="p-3 text-ink">{row.householdName}</td>
                          <td className="p-3 text-ink">{row.ownerName ?? "—"}</td>
                          <td className="p-3 text-ink-muted">{formatDate(row.trialEndedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableCard>
          </div>
        ) : null}

        {tab === "outreach" ? (
          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <TableCard title="إشعار جماعي">
              <AdminBroadcastForm
                iosDeviceCount={stats.iosDeviceCount}
                lapsedHouseholdCount={stats.subscriptionsLapsed}
              />
            </TableCard>

            {/* The actual names/phones behind the "انتهت تجربتهم" push
                audience above and the "انتهت التجربة بدون اشتراك" stat
                card — most have no push enabled, so WhatsApp/email are
                the real way to reach this list. */}
            <TableCard title="تواصل مباشر — انتهت تجربتهم">
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
                              {row.ownerPhone ?? "—"}
                            </bdi>
                          </td>
                          <td className="p-3">
                            <ContactIcons phone={row.ownerPhone} email={row.ownerEmail} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TableCard>
          </div>
        ) : null}

        {tab === "feedback" ? (
          <TableCard title="ملاحظات واقتراحات المستخدمين">
            {feedback.length === 0 ? (
              <p className="hl-caption text-ink-muted">ما وصلت ملاحظات بعد.</p>
            ) : (
              <div className="grid gap-2 lg:grid-cols-2">
                {feedback.map((row) => (
                  <Card key={row.id} className="space-y-1.5">
                    <p className="hl-body whitespace-pre-wrap text-ink">{row.message}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="hl-caption text-ink-muted">
                        {row.displayName ?? "—"}
                        {row.countryCode ? ` · ${countryLabel(row.countryCode, "ar")}` : ""}
                        {" · "}
                        {formatDate(row.createdAt)}
                      </p>
                      <ContactIcons phone={row.phoneNumber} email={row.email} />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TableCard>
        ) : null}
      </div>
    </main>
  );
}
