"use client";

import Link from "next/link";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { QuickInviteWorker } from "@/components/household/QuickInviteWorker";
import { InstallGuide } from "@/components/pwa/InstallGuide";
import { Card, Screen } from "@/components/ui/Primitives";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/** `unreadCount` is currently unused here — the bottom tab bar's own
 * Notifications tab carries the badge instead of this screen's header —
 * kept as a prop so the caller (app/home/dashboard/page.tsx) doesn't need
 * to change its data fetching if a header badge comes back later.
 *
 * People/Invitations live in Settings now, not here (2026-08 feedback)
 * — see components/household/SettingsScreen.tsx — with one exception:
 * QuickInviteWorker, right under the greeting, is a one-tap shortcut to
 * create-and-share a helper invite without leaving the dashboard.
 * Managing existing invitations is still Settings' job; this is only
 * ever the fast path to a first (or another) one (2026-09 request: make
 * adding a helper easier and faster, right where a brand-new owner
 * lands). It disappears once the household has a worker (`hasWorker`) —
 * at that point it would just be clutter above the list the household
 * actually came here to look at; inviting a second helper is a rarer
 * enough need that Settings → Invitations is fine for it.
 *
 * Two lists, one screen, and they used to be easy to mix up: the
 * gradient hero card (what a helper sent, needing this person's review)
 * sat right above a flat "My own list" button (this person's own
 * errand, unrelated to the helper) with nothing telling them apart but
 * shape and color. Each now sits under its own plain-language label —
 * "A request from {name}" / "Your own shopping" — so which is which
 * reads before either card does (2026-09 feedback). The category grid
 * that used to sit between them is gone entirely: it only ever
 * previewed the same categories "My own list" opens onto, so it was a
 * second path to the same screen, not a second capability. */
export function HouseholdDashboard({
  householdId,
  householdName,
  hasWorker,
  memberCount,
  recentLists,
  openCount,
  displayName,
  greetingKey,
}: {
  householdId: string;
  householdName: string;
  hasWorker: boolean;
  memberCount: number;
  recentLists: HouseholdList[];
  openCount: number;
  unreadCount: number;
  displayName: string | null;
  greetingKey: MessageKey;
}) {
  const { t } = useLocale();

  // The freshest list still worth acting on — sent or opened, not yet
  // completed. Shown large up top; "Lists" below links out to the rest
  // when there ARE any — with only one open list, that one IS this hero
  // card, so the row would just repeat it.
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
        <MachlaLockup size={34} showArabic={false} />
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

      {hasWorker ? null : <QuickInviteWorker householdId={householdId} />}

      <InstallGuide />

      {heroList ? (
        <div className="space-y-2">
          <p className="hl-caption text-ink-muted">
            {t("home.receivedLabel", { name: heroList.created_by_name ?? t("hlists.someone") })}
          </p>
          <HeroListCard list={heroList} />
        </div>
      ) : (
        <EmptyHero />
      )}

      {/* Same mechanism a helper uses to build and send a list
          (app/home/shop/*, a `basePath`-scoped reuse of the worker
          screens) — for the things the owner/member wants to buy
          themselves, not through a helper. Styled as a sibling of
          HeroListCard (same shape, neutral instead of gradient — the
          gradient CTA slot above is already spent) rather than a flat
          button, so the two read as one family: "here's a list", twice,
          each labeled with whose it is. */}
      <div className="space-y-2">
        <p className="hl-caption text-ink-muted">{t("home.ownListLabel")}</p>
        <Link
          href="/home/shop"
          className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-5 shadow-sm active:bg-surface-2"
        >
          <div className="min-w-0">
            <p className="hl-heading text-ink">{t("home.myOwnList")}</p>
            <p className="hl-caption mt-1">{t("home.ownListHint")}</p>
          </div>
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-primary-tint text-xl"
          >
            🧺
          </span>
        </Link>
      </div>

      {/* The full list inbox lives at /home/lists (ListsInbox.tsx).
          Shown only past one open list: with zero or one, heroList above
          already covers it, and this row would just repeat the same
          list under a second link. */}
      {openCount > 1 ? (
        <Link
          href="/home/lists"
          className="flex items-center justify-between rounded-lg border border-line bg-surface px-5 py-4 shadow-sm active:bg-surface-2"
        >
          <span className="hl-label text-ink-muted">{t("hlists.lists")}</span>
          <span className="hl-caption rounded-pill bg-primary-tint px-2 py-0.5 text-primary">
            {t("hlists.openLists", { count: openCount })}
          </span>
        </Link>
      ) : null}
    </Screen>
  );
}

/** The hero panel — one of the two places on any screen the gradient is
 * allowed (app/globals.css: "the mark, hero panels, the single gradient
 * CTA per screen"). A ring rather than a bar here, matching the kit's
 * home screen; the checklist itself (ListDetail) keeps the bar, where a
 * long list makes a ring harder to read at a glance.
 *
 * No "from {name}" line inside the card anymore — the caller already
 * puts that above it as this whole area's label (home.receivedLabel),
 * so repeating the name in here would say it twice. */
function HeroListCard({ list }: { list: HouseholdList }) {
  const { t } = useLocale();

  const total = Number(list.total_items);
  const purchased = Number(list.purchased_items);
  const remaining = Math.max(total - purchased, 0);
  const percent = total ? Math.round((purchased / total) * 100) : 0;

  return (
    <Link
      // ?from=home so the list screen's own Back link returns here
      // instead of to the full list inbox — this hero card is reached
      // from the dashboard, not from /home/lists.
      href={`/home/lists/${list.id}?from=home`}
      className="hl-gradient-cta relative flex items-center justify-between gap-4 overflow-hidden rounded-lg p-5"
    >
      <div className="min-w-0">
        <p className="hl-title text-on-primary">
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
