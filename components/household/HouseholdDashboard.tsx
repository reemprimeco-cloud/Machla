"use client";

import Link from "next/link";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { Card, Screen } from "@/components/ui/Primitives";
import type { Category } from "@/lib/catalog/queries";
import { localizedName } from "@/lib/catalog/localized";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

import { Progress } from "./ListsInbox";

/** `unreadCount` is currently unused here — the bottom tab bar's own
 * Notifications tab carries the badge instead of this screen's header —
 * kept as a prop so the caller (app/home/dashboard/page.tsx) doesn't need
 * to change its data fetching if a header badge comes back later.
 *
 * Home-screen layout follows the Machla UI Kit's home screen (greeting,
 * hero progress card, category grid, "Your lists") with one deliberate
 * subtraction: no prices, no cart, no checkout — this app was never
 * repriced, only reskinned (docs/design/BRAND.md, 2026-08 renovation).
 * People/Invitations live in Settings now, not here (2026-08 feedback)
 * — see components/household/SettingsScreen.tsx. */
export function HouseholdDashboard({
  householdName,
  memberCount,
  recentLists,
  openCount,
  categories,
  displayName,
  greetingKey,
}: {
  householdName: string;
  memberCount: number;
  recentLists: HouseholdList[];
  openCount: number;
  unreadCount: number;
  categories: Category[];
  displayName: string | null;
  greetingKey: MessageKey;
}) {
  const { t, locale } = useLocale();

  // The freshest list still worth acting on — sent or opened, not yet
  // completed. Shown large up top; "Your lists" below still lists it
  // again alongside the rest, same as the kit's own home screen does.
  const heroList = recentLists.find((list) => list.status !== "completed");

  return (
    <Screen>
      <div className="flex items-center justify-between">
        <Link
          href="/home/settings"
          aria-label={t("settings.title")}
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary-tint text-lg"
        >
          <span aria-hidden>👤</span>
        </Link>
        <MachlaLockup size={26} showArabic={false} />
        <Link
          href="/home/shop/search"
          aria-label={t("worker.browse")}
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-surface-2 text-lg"
        >
          <span aria-hidden>🔍</span>
        </Link>
      </div>

      <div>
        <h1 className="hl-title text-ink">
          {t(greetingKey, { name: displayName || t("members.unnamed") })}
        </h1>
        <p className="hl-caption mt-1">
          {t("home.overview", { openCount, memberCount })} · {householdName}
        </p>
      </div>

      {heroList ? <HeroListCard list={heroList} /> : <EmptyHero />}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="hl-label text-ink-muted">{t("home.categories")}</h2>
          <Link href="/home/shop" className="hl-caption text-primary">
            {t("home.seeAll")}
          </Link>
        </div>
        <ul className="grid grid-cols-3 gap-3">
          {categories.slice(0, 6).map((category) => (
            <li key={category.id}>
              <Link
                href={
                  category.is_capture
                    ? "/home/shop/photo"
                    : `/home/shop/c/${category.key}`
                }
                className="flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-3 text-center shadow-sm active:bg-surface-2"
              >
                <span aria-hidden className="text-2xl leading-none">
                  {category.icon ?? "📦"}
                </span>
                <span className="hl-caption truncate text-ink">
                  {localizedName(category, locale)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Same mechanism a helper uses to build and send a list
          (app/home/shop/*, a `basePath`-scoped reuse of the worker
          screens) — for the things the owner/member wants to buy
          themselves, not through a helper. */}
      <Link
        href="/home/shop"
        className="hl-label flex min-h-14 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-on-primary shadow-sm active:bg-primary-hover"
      >
        <span aria-hidden>🧺</span>
        <span>{t("home.myOwnList")}</span>
      </Link>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="hl-label text-ink-muted">{t("hlists.lists")}</h2>
          {openCount > 0 ? (
            <span className="hl-caption rounded-pill bg-primary-tint px-2 py-0.5 text-primary">
              {t("hlists.openLists", { count: openCount })}
            </span>
          ) : null}
        </div>

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
                      list.status === "sent" ? "border-primary" : "border-line"
                    }`}
                  >
                    <span className="hl-heading truncate text-ink">
                      {t("hlists.from", {
                        name: list.created_by_name ?? t("hlists.someone"),
                      })}
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
      </section>
    </Screen>
  );
}

/** The hero panel — one of the two places on any screen the gradient is
 * allowed (app/globals.css: "the mark, hero panels, the single gradient
 * CTA per screen"). A ring rather than a bar here, matching the kit's
 * home screen; the checklist itself (ListDetail) keeps the bar, where a
 * long list makes a ring harder to read at a glance. */
function HeroListCard({ list }: { list: HouseholdList }) {
  const { t } = useLocale();

  const total = Number(list.total_items);
  const purchased = Number(list.purchased_items);
  const remaining = Math.max(total - purchased, 0);
  const percent = total ? Math.round((purchased / total) * 100) : 0;

  return (
    <Link
      href={`/home/lists/${list.id}`}
      className="hl-gradient-cta relative flex items-center justify-between gap-4 overflow-hidden rounded-lg p-5"
    >
      <div className="min-w-0">
        <p className="hl-caption text-on-primary/80 uppercase tracking-wide">
          {t("hlists.from", { name: list.created_by_name ?? t("hlists.someone") })}
        </p>
        <p className="hl-title mt-1 text-on-primary">
          {remaining > 0
            ? t("hlists.itemsLeft", { count: remaining })
            : t("hlists.allDone")}
        </p>
        <span className="hl-label mt-3 inline-flex items-center gap-1 rounded-pill bg-white/25 px-3 py-1.5 text-on-primary">
          {t("hlists.openList")}
          <span aria-hidden className="rtl:-scale-x-100">
            →
          </span>
        </span>
      </div>
      <ProgressRing percent={percent} />
    </Link>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 64;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="hl-label absolute inset-0 flex items-center justify-center text-on-primary">
        {percent}%
      </span>
    </div>
  );
}

function EmptyHero() {
  const { t } = useLocale();
  return (
    <Card>
      <p className="hl-heading text-ink">{t("hlists.noLists")}</p>
      <p className="hl-caption mt-1">{t("hlists.noListsHint")}</p>
    </Card>
  );
}
