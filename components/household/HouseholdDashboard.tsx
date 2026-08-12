"use client";

import Link from "next/link";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { Card, Screen } from "@/components/ui/Primitives";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { HouseholdRole } from "@/lib/supabase/database.types";

import { Progress } from "./ListsInbox";

/** `unreadCount` is currently unused here — the bottom tab bar's own
 * Notifications tab carries the badge instead of this screen's header —
 * kept as a prop so the caller (app/home/dashboard/page.tsx) doesn't need
 * to change its data fetching if a header badge comes back later. */
export function HouseholdDashboard({
  householdName,
  role,
  memberCount,
  recentLists,
  openCount,
}: {
  householdName: string;
  role: HouseholdRole;
  memberCount: number;
  recentLists: HouseholdList[];
  openCount: number;
  unreadCount: number;
}) {
  const { t } = useLocale();

  return (
    <Screen>
      <div className="flex items-center justify-center py-2">
        <MachlaLockup size={28} />
      </div>
      <h1 className="hl-title text-center text-ink">{householdName}</h1>

      {/* Lists come first: receiving them is what this side of the app is
          for, and an owner opening it usually wants the newest one. */}
      {recentLists.length === 0 ? (
        <Card>
          <p className="hl-heading text-ink">{t("hlists.noLists")}</p>
          <p className="hl-caption mt-1">{t("hlists.noListsHint")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {recentLists.map((list) => {
            const total = Number(list.total_items);
            const purchased = Number(list.purchased_items);
            return (
              <li key={list.id}>
                <Link
                  href={`/home/lists/${list.id}`}
                  className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 shadow-sm active:bg-surface-2 ${
                    list.status === "sent" ? "border-green-700" : "border-sand"
                  }`}
                >
                  <span className="hl-heading truncate text-ink">
                    {t("hlists.from", { name: list.created_by_name ?? t("hlists.someone") })}
                  </span>
                  <Progress
                    purchased={purchased}
                    total={total}
                    percent={total ? Math.round((purchased / total) * 100) : 0}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Same mechanism a helper uses to build and send a list
          (app/home/shop/*, a `basePath`-scoped reuse of the worker
          screens) — for the things the owner/member wants to buy
          themselves, not through a helper. */}
      <Link
        href="/home/shop"
        className="hl-label flex min-h-14 items-center justify-center gap-2 rounded-lg bg-green-700 px-5 text-on-green shadow-sm active:bg-green-600"
      >
        <span aria-hidden>🧺</span>
        <span>{t("home.myOwnList")}</span>
      </Link>

      <nav className="flex flex-col gap-3">
        <Link
          href="/home/lists"
          className="flex min-h-14 items-center justify-between rounded-lg border border-sand bg-surface px-5 shadow-sm active:bg-surface-2"
        >
          <span className="hl-heading text-ink">{t("hlists.lists")}</span>
          {openCount > 0 ? (
            <span className="hl-caption rounded-pill bg-green-700 px-2 py-0.5 text-on-green">
              {t("hlists.openLists", { count: openCount })}
            </span>
          ) : null}
        </Link>

        <Link
          href="/home/members"
          className="flex min-h-14 items-center justify-between rounded-lg border border-sand bg-surface px-5 shadow-sm active:bg-surface-2"
        >
          <span className="hl-heading text-ink">{t("home.people")}</span>
          <span className="hl-caption">{t("home.peopleCount", { count: memberCount })}</span>
        </Link>

        {/* Invitation management is owner-only — the route itself also
            redirects a non-owner, and the RPCs refuse them regardless
            (docs/architecture/04-roles-permission-matrix.md). */}
        {role === "owner" ? (
          <Link
            href="/home/invitations"
            className="flex min-h-14 items-center rounded-lg border border-sand bg-surface px-5 shadow-sm active:bg-surface-2"
          >
            <span className="hl-heading text-ink">{t("home.invitations")}</span>
          </Link>
        ) : null}
      </nav>
    </Screen>
  );
}
