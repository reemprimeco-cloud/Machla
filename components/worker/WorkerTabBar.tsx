"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BellGlyph, HomeGlyph } from "@/components/household/HomeTabBar";
import { PrimaryPill } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Tab = "home" | "lists" | "notifications";

/** Matches HomeGlyph/BellGlyph's stroke width and joins — two checklist
 * rows rather than a basket, so it reads as "your list history" and
 * doesn't compete with WorkerBar's own basket-with-count button, which
 * still means "what's in the list I'm building right now". */
function ListGlyph() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <rect x="3.5" y="5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.5 7h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <rect x="3.5" y="15" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1.9" />
      <path d="M10.5 17h10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

const TABS: {
  tab: Tab;
  href: string;
  Icon: () => React.JSX.Element;
  labelKey: MessageKey;
}[] = [
  { tab: "home", href: "/worker", Icon: HomeGlyph, labelKey: "home.tabHomes" },
  { tab: "lists", href: "/worker/lists", Icon: ListGlyph, labelKey: "notif.myLists" },
  { tab: "notifications", href: "/notifications", Icon: BellGlyph, labelKey: "notif.title" },
];

/**
 * The worker-track counterpart to HomeTabBar — a persistent bottom bar
 * so a helper can reach their sent-list history or their notifications
 * from anywhere, the same one-tap access an owner/member already has,
 * instead of scrolling to a buried link on the category screen or
 * relying on WorkerBar's own back arrow (2026-09 request: the two
 * tracks had grown asymmetric — one always-visible switcher, one
 * screen-by-screen back button with no way to jump anywhere else).
 *
 * Mounted by app/worker/layout.tsx for every /worker/* route, and
 * rendered directly by NotificationsScreen for a worker caller — that
 * screen lives at the top-level /notifications route, shared with the
 * household experience, so it sits outside this layout the same way
 * HomeTabBar sits outside it for a household caller (see that
 * component's own comment).
 */
export function WorkerTabBar() {
  const { t } = useLocale();
  const pathname = usePathname();

  // Same shape as HomeTabBar.isActive: the two specific tabs claim their
  // own prefix first, and "home" is whatever's left under /worker/* —
  // every step of the shopping flow (categories, search, the basket
  // review, a captured photo, a sent list's detail) that isn't the
  // history list itself.
  function isActive(tab: Tab, href: string): boolean {
    if (tab === "lists") return pathname.startsWith("/worker/lists");
    if (tab === "notifications") return pathname.startsWith("/notifications");
    return pathname.startsWith(href) && !pathname.startsWith("/worker/lists");
  }

  return (
    <nav
      aria-label={t("home.tabBarLabel")}
      className="fixed inset-x-0 bottom-0 z-20 flex justify-center px-5"
      style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex h-[68px] w-full max-w-[calc(var(--hl-content-max)_-_40px)] items-center justify-around rounded-pill border border-glass-border-strong bg-nav-bg px-2 shadow-nav backdrop-blur-[24px]">
        {TABS.map(({ tab, href, Icon, labelKey }) => {
          const active = isActive(tab, href);
          const label = t(labelKey);
          return active ? (
            <PrimaryPill key={tab} href={href} aria-current="page">
              <Icon />
              <span>{label}</span>
            </PrimaryPill>
          ) : (
            <Link
              key={tab}
              href={href}
              aria-label={label}
              className="flex size-12 shrink-0 items-center justify-center rounded-pill text-ink-muted transition-colors duration-150 ease-hl active:text-ink"
            >
              <Icon />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
