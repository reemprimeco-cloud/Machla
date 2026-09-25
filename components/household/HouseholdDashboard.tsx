"use client";

import Link from "next/link";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { CompleteAccountBanner } from "@/components/auth/CompleteAccountBanner";
import { QuickInviteWorker } from "@/components/household/QuickInviteWorker";
import { InstallGuide } from "@/components/pwa/InstallGuide";
import { BasketIcon, ChevronIcon, ListIcon, PersonIcon, SearchIcon } from "@/components/ui/Icons";
import { Card, GlassIconButton, Screen } from "@/components/ui/Primitives";
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
  ownListItemCount,
  displayName,
  greetingKey,
  accountCompleted,
  multipleHomes,
}: {
  householdId: string;
  householdName: string;
  hasWorker: boolean;
  memberCount: number;
  recentLists: HouseholdList[];
  openCount: number;
  unreadCount: number;
  /** Items already on the caller's own draft (app/home/dashboard/page.tsx
   * — getDraftList). Decides where "My own list" points: straight into
   * the review screen when there's something to review, the categories
   * grid to start one when there isn't (2026-09 feedback: landing back
   * on categories every time forces a detour once you're already
   * shopping). */
  ownListItemCount: number;
  displayName: string | null;
  greetingKey: MessageKey;
  /** Whether this account has added an email/username + password yet
   * (users.account_completed_at) — see CompleteAccountBanner. */
  accountCompleted: boolean;
  /** Whether the signed-in user has more than one owner/member household
   * (app/home/dashboard/page.tsx — getActiveMemberships). The bottom tab
   * bar's "Homes" tab already lands on `/home`, which shows the switcher
   * for exactly this case (app/home/page.tsx) — but that tab reads as
   * "active" on every /home/* route, including this one, so tapping it
   * again from here isn't obvious. This link makes the same destination
   * explicit and visible right where a multi-household owner actually
   * needs it (2026-09 feedback, asked three times). Hidden entirely for
   * the common one-household case, where `/home` would just bounce
   * straight back to this same screen. */
  multipleHomes: boolean;
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
        <GlassIconButton href="/home/settings" aria-label={t("settings.title")}>
          <PersonIcon className="size-5" />
        </GlassIconButton>
        <MachlaLockup size={34} showArabic={false} />
        <GlassIconButton href="/home/shop/search" aria-label={t("worker.browse")}>
          <SearchIcon className="size-5" />
        </GlassIconButton>
      </div>

      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
          {t(greetingKey, { name: displayName || t("members.unnamed") })}
        </h1>
        <p className="hl-caption mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span>
            {t("home.overview", { openCount, memberCount })} · {householdName}
          </span>
          {multipleHomes ? (
            <Link href="/home" className="text-primary underline underline-offset-2">
              {t("home.myHomes")}
            </Link>
          ) : null}
        </p>
      </div>

      {accountCompleted ? null : <CompleteAccountBanner />}

      {hasWorker ? null : <QuickInviteWorker householdId={householdId} />}

      <InstallGuide />

      {/* Sender/label now lives inside the card itself (the chip at its
          top-start) rather than above it — MACHLA_UI_REFRESH.md §4.1. */}
      {heroList ? <HeroListCard list={heroList} /> : <EmptyHero />}

      {/* Same mechanism a helper uses to build and send a list
          (app/home/shop/*, a `basePath`-scoped reuse of the worker
          screens) — for the things the owner/member wants to buy
          themselves, not through a helper. A 2-column quick-actions grid
          (§4.1.4) replaces the previous two full-width cards; same
          destinations and handlers, just laid out side by side when
          there's a second tile to show.
          Skips the categories grid straight to the review screen once
          there's already something on the draft — that screen's own
          Back link (app/home/shop/list/page.tsx) returns here, one step,
          not to a categories grid this visit never passed through. */}
      {/* The full list inbox lives at /home/lists (ListsInbox.tsx). Its
          tile is shown only past one open list: with zero or one, heroList
          above already covers it, and this tile would just repeat the
          same list under a second link. */}
      {openCount > 1 ? (
        <div className="grid grid-cols-2 gap-3">
          <OwnListTile ownListItemCount={ownListItemCount} />
          <Link
            href="/home/lists"
            className="flex flex-col gap-3 rounded-card border border-glass-border bg-glass-bg p-[18px] shadow-card backdrop-blur-[20px] transition-colors duration-150 ease-hl active:bg-white/40"
          >
            <span
              aria-hidden
              className="flex size-[46px] items-center justify-center rounded-icon bg-[#0B1F3F] text-white"
            >
              <ListIcon className="size-6" />
            </span>
            <div>
              <p className="text-[17px] font-bold text-ink">{t("hlists.lists")}</p>
              <span className="mt-1 inline-block rounded-pill bg-badge-pink-bg px-2 py-0.5 text-xs font-semibold text-badge-pink-text">
                {t("hlists.openLists", { count: openCount })}
              </span>
            </div>
          </Link>
        </div>
      ) : (
        <OwnListTile ownListItemCount={ownListItemCount} />
      )}
    </Screen>
  );
}

/** "قائمتي الخاصة" quick-action tile — §4.1.4. Same destination logic as
 * before: straight into the review screen once the draft has something on
 * it, the categories grid to start one when it doesn't. */
function OwnListTile({ ownListItemCount }: { ownListItemCount: number }) {
  const { t } = useLocale();
  return (
    <Link
      href={ownListItemCount > 0 ? "/home/shop/list" : "/home/shop"}
      className="flex flex-col gap-3 rounded-card border border-glass-border bg-glass-bg p-[18px] shadow-card backdrop-blur-[20px] transition-colors duration-150 ease-hl active:bg-white/40"
    >
      <span
        aria-hidden
        className="hl-gradient-cta flex size-[46px] items-center justify-center rounded-icon text-on-primary"
      >
        <BasketIcon className="size-6" />
      </span>
      <div>
        <p className="text-[17px] font-bold text-ink">{t("home.myOwnList")}</p>
        <p className="hl-caption mt-0.5">
          {ownListItemCount > 0
            ? t("home.ownListContinue", { count: ownListItemCount })
            : t("home.ownListHint")}
        </p>
      </div>
    </Link>
  );
}

/** The hero panel — one of the two places on any screen the gradient is
 * allowed (app/globals.css: "the mark, hero panels, the single gradient
 * CTA per screen"). Soft Glass §4.1.3: gradient-hero (not the CTA
 * gradient — a distinct 3-stop ending in orange), two decorative
 * translucent circles clipped to the rounded corners, a glass sender chip,
 * a glass "open" chip, and a bigger progress ring. A ring rather than a
 * bar here, matching the kit's home screen; the checklist itself
 * (ListDetail) keeps the bar, where a long list makes a ring harder to
 * read at a glance. */
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
      className="relative isolate flex items-center justify-between gap-4 overflow-hidden rounded-hero p-[22px] shadow-hero"
      style={{ backgroundImage: "var(--hl-gradient-hero)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-10 -start-10 size-[190px] rounded-full bg-white/[0.13]"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-10 end-2 size-40 rounded-full bg-white/[0.08]"
      />

      <div className="relative min-w-0">
        <span className="inline-flex items-center gap-1 rounded-pill border border-white/40 bg-white/[0.22] px-3 py-1 text-[12px] font-semibold text-white">
          {t("home.receivedLabel", { name: list.created_by_name ?? t("hlists.someone") })}
        </span>
        <p className="mt-3 text-[28px] font-bold leading-tight text-white">
          {remaining > 0
            ? t("hlists.itemsLeft", { count: remaining })
            : t("hlists.allDone")}
        </p>
        <span className="mt-4 inline-flex h-11 items-center gap-1 rounded-pill border border-white/50 bg-white/[0.24] px-4 text-[15px] font-semibold text-white backdrop-blur-[12px]">
          {t("hlists.openList")}
          <ChevronIcon className="size-3.5 rtl:-scale-x-100" />
        </span>
      </div>
      <ProgressRing percent={percent} />
    </Link>
  );
}

function ProgressRing({ percent }: { percent: number }) {
  const size = 92;
  const stroke = 9;
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
          stroke="rgba(255,255,255,0.28)"
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
      <span className="absolute inset-0 flex items-center justify-center text-[21px] font-bold text-white">
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
