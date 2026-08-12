"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Tab = "homes" | "notifications" | "settings";

/** Line icons, not emoji — matching the Machla UI Kit's nav system
 * (stroke width 1.9, round joins), which renders identically across
 * platforms and languages; an emoji glyph varies by OS font and some
 * (⚙️) render inconsistently in RTL browsers. */
function HomeGlyph() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellGlyph() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <path
        d="M12 3a5 5 0 00-5 5v3.2c0 .8-.3 1.5-.9 2.1L5 14.5h14l-1.1-1.2a3 3 0 01-.9-2.1V8a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d="M10 17.5a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function AccountGlyph() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden focusable="false">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M4.5 20c1.2-3.7 4-5.5 7.5-5.5s6.3 1.8 7.5 5.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

const TABS: {
  tab: Tab;
  href: string;
  Icon: () => React.JSX.Element;
  labelKey: MessageKey;
}[] = [
  { tab: "homes", href: "/home", Icon: HomeGlyph, labelKey: "home.tabHomes" },
  {
    tab: "notifications",
    href: "/notifications",
    Icon: BellGlyph,
    labelKey: "notif.title",
  },
  {
    tab: "settings",
    href: "/home/settings",
    Icon: AccountGlyph,
    labelKey: "home.tabSettings",
  },
];

/**
 * The persistent bottom tab bar for the owner/member experience — an
 * iOS-style always-visible switcher between the household list,
 * notifications, and account settings, rather than a single dashboard
 * with no way back out to a different household.
 *
 * Fixed to the viewport bottom by `app/home/layout.tsx`; every /home/*
 * page renders inside a wrapper that reserves space for it so content
 * never sits underneath it.
 *
 * The active tab is read from the URL, not passed in: `/notifications` is
 * shared with the worker experience (one inbox, two entry points — see
 * `app/notifications/page.tsx`), so this bar isn't mounted there via
 * layout nesting — `NotificationsScreen` renders it directly for an
 * owner/member caller, and pathname-matching is what makes "Notifications"
 * light up correctly there without a prop threaded across two mount
 * points. `/home/settings` matches "settings"; everything else under
 * `/home` (the switcher, the dashboard, lists, members, invitations) is
 * "homes" — those all live inside one household's context, not a
 * separate section of their own.
 */
export function HomeTabBar() {
  const { t } = useLocale();
  const pathname = usePathname();

  function isActive(tab: Tab, href: string): boolean {
    if (tab === "settings") return pathname.startsWith("/home/settings");
    if (tab === "notifications") return pathname.startsWith("/notifications");
    return pathname.startsWith(href) && !pathname.startsWith("/home/settings");
  }

  return (
    <nav
      aria-label={t("home.tabBarLabel")}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-[var(--hl-content-max)]">
        {TABS.map(({ tab, href, Icon, labelKey }) => {
          const active = isActive(tab, href);
          return (
            <Link
              key={tab}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 ${
                active ? "hl-tab-indicator text-primary" : "text-ink-muted"
              }`}
            >
              <Icon />
              <span className="hl-caption">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
