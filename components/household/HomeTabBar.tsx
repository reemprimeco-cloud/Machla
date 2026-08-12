"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Tab = "homes" | "notifications" | "settings";

const TABS: { tab: Tab; href: string; icon: string; labelKey: MessageKey }[] = [
  { tab: "homes", href: "/home", icon: "🏠", labelKey: "home.tabHomes" },
  {
    tab: "notifications",
    href: "/notifications",
    icon: "🔔",
    labelKey: "notif.title",
  },
  {
    tab: "settings",
    href: "/home/settings",
    icon: "⚙️",
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
        {TABS.map(({ tab, href, icon, labelKey }) => {
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
              <span aria-hidden className="text-xl leading-none">
                {icon}
              </span>
              <span className="hl-caption">{t(labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
