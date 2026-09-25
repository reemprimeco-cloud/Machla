"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { BasketIcon, BellIcon, HeartIcon, SearchIcon } from "@/components/ui/Icons";
import { BackLink, GlassIconButton, PrimaryPill } from "@/components/ui/Primitives";
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
  basePath = "/worker",
  targetListId,
}: {
  title: string;
  backHref?: string;
  itemCount: number;
  // Kept in the prop type (not part of this component's public API to
  // remove, and every caller still passes it) even though the header no
  // longer renders a bell for it — MACHLA_UI_REFRESH.md §4.2: the bottom
  // tab bar's own Notifications tab already carries this, so the header
  // copy was a duplicate shortcut.
  unreadCount?: number;
  /** Lets this same chrome serve a second flow — a household owner/member
   * building their own list (`app/home/shop/*`), reusing every worker
   * screen unchanged apart from where its links point. Defaults to the
   * worker experience these components were built for. */
  basePath?: string;
  /** Set while adding to an already-sent list (QuantityStepper.tsx) —
   * hides the "my list" basket button rather than pointing it at
   * `${basePath}/list`, a draft this flow has nothing to do with. */
  targetListId?: string;
}) {
  const { t } = useLocale();

  return (
    <div className="sticky top-0 z-10 mb-2 flex items-center gap-3 py-2">
      {backHref ? <BackLink href={backHref} label={t("common.back")} /> : null}

      <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold text-ink">{title}</h1>

      {targetListId ? null : (
        <GlassIconButton href={`${basePath}/favorites`} aria-label={t("worker.favorites")}>
          <HeartIcon className="size-5" />
        </GlassIconButton>
      )}

      {targetListId ? null : (
        <PrimaryPill href={`${basePath}/list`}>
          <BasketIcon className="size-5" />
          <span>{itemCount}</span>
          <span className="sr-only">
            {t("worker.myListWithCount", { count: itemCount })}
          </span>
        </PrimaryPill>
      )}
    </div>
  );
}

/** Search entry. Submits to a route rather than filtering in place so a
 * result page can be linked, shared and re-entered — and so the search
 * itself runs in Postgres, across all nine languages at once, which no
 * client-side filter could reproduce. */
export function SearchBox({
  initialQuery = "",
  basePath = "/worker",
  targetListId,
}: {
  initialQuery?: string;
  basePath?: string;
  /** Carried through to the search results page as `?listId=` — see
   * QuantityStepper.tsx's targetListId. */
  targetListId?: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        const params = new URLSearchParams({ q: trimmed });
        if (targetListId) params.set("listId", targetListId);
        router.push(`${basePath}/search?${params.toString()}`);
      }}
      className="relative flex gap-2"
    >
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-4 my-auto size-5 text-ink-muted"
      />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("worker.searchPlaceholder")}
        aria-label={t("worker.searchPlaceholder")}
        className="hl-body h-[54px] w-full rounded-pill border border-glass-border-strong bg-glass-bg-strong ps-11 pe-5 text-ink outline-none backdrop-blur-[20px] focus-visible:border-primary"
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
      className="relative flex size-12 shrink-0 items-center justify-center rounded-pill border border-line bg-surface text-ink"
    >
      <BellIcon className="size-5" />
      {unreadCount > 0 ? (
        <span
          aria-hidden
          className="absolute -top-1 -end-1 min-w-5 rounded-pill bg-danger px-1 text-center text-xs leading-5 text-white"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
      <span className="sr-only">{unreadCount}</span>
    </Link>
  );
}
