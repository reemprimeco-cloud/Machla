"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The two pieces of chrome every worker screen shares: a back/title bar
 * and a persistent "my list" button.
 *
 * The list button is always visible, including at zero items. A worker
 * with limited literacy needs the way back to their list to be in the same
 * place every time, not to appear only once they have added something.
 */

export function WorkerBar({
  title,
  backHref,
  itemCount,
  unreadCount = 0,
}: {
  title: string;
  backHref?: string;
  itemCount: number;
  unreadCount?: number;
}) {
  const { t } = useLocale();

  return (
    <div className="sticky top-0 z-10 -mx-5 mb-2 flex items-center gap-3 border-b border-sand bg-bg/95 px-5 py-3 backdrop-blur">
      {backHref ? (
        <Link
          href={backHref}
          aria-label={t("common.back")}
          className="flex size-11 shrink-0 items-center justify-center rounded-pill border border-sand bg-surface text-ink"
        >
          {/* Mirrors automatically in RTL: the glyph is flipped by the
              parent's direction, so no per-locale icon swap is needed. */}
          <span aria-hidden className="rtl:-scale-x-100 text-lg leading-none">
            ‹
          </span>
        </Link>
      ) : null}

      <h1 className="hl-heading min-w-0 flex-1 truncate text-ink">{title}</h1>

      <NotificationBell unreadCount={unreadCount} />

      <Link
        href="/worker/list"
        className="hl-label flex min-h-11 shrink-0 items-center gap-2 rounded-pill bg-green-700 px-4 text-on-green"
      >
        <span aria-hidden>🧺</span>
        <span>{itemCount}</span>
        <span className="sr-only">{t("worker.myListWithCount", { count: itemCount })}</span>
      </Link>
    </div>
  );
}

/** Search entry. Submits to a route rather than filtering in place so a
 * result page can be linked, shared and re-entered — and so the search
 * itself runs in Postgres, across all nine languages at once, which no
 * client-side filter could reproduce. */
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const { t } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (trimmed) router.push(`/worker/search?q=${encodeURIComponent(trimmed)}`);
      }}
      className="flex gap-2"
    >
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("worker.searchPlaceholder")}
        aria-label={t("worker.searchPlaceholder")}
        className="hl-body min-h-12 w-full rounded-pill border border-sand bg-surface px-5 text-ink outline-none focus-visible:border-green-700"
      />
    </form>
  );
}

/** Unread badge. A dot rather than a count once it passes 9: the exact
 * number stops mattering and a two-digit badge crowds the bar. */
export function NotificationBell({ unreadCount }: { unreadCount: number }) {
  const { t } = useLocale();

  return (
    <Link
      href="/notifications"
      aria-label={t("notif.title")}
      className="relative flex size-11 shrink-0 items-center justify-center rounded-pill border border-sand bg-surface"
    >
      <span aria-hidden className="text-lg leading-none">
        🔔
      </span>
      {unreadCount > 0 ? (
        <span
          aria-hidden
          className="absolute -top-1 -end-1 min-w-5 rounded-pill bg-danger px-1 text-center text-xs leading-5 text-cream"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
      <span className="sr-only">{unreadCount}</span>
    </Link>
  );
}
