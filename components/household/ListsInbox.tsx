"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Card, Screen } from "@/components/ui/Primitives";
import { deleteListAction } from "@/lib/list/actions";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/** Width of the revealed Delete button, in px. */
const REVEAL_WIDTH = 88;

/** Status → badge label. The database values are stable identifiers;
 * only the display string is localized. */
const STATUS_KEYS: Record<string, MessageKey> = {
  sent: "hlists.statusSent",
  viewed: "hlists.statusViewed",
  completed: "hlists.statusCompleted",
};

export function ListsInbox({ lists }: { lists: HouseholdList[] }) {
  const { t } = useLocale();
  // Hidden the instant a delete succeeds, rather than waiting on the
  // Server Action's own revalidatePath to reach this already-rendered
  // page — router.refresh() (called alongside) will reconcile this
  // against the real data shortly after anyway.
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const visibleLists = lists.filter((list) => !hiddenIds.has(list.id));

  return (
    <Screen title={t("hlists.lists")}>
      {visibleLists.length === 0 ? (
        <Card>
          <p className="hl-heading text-ink">{t("hlists.noLists")}</p>
          <p className="hl-caption mt-1">{t("hlists.noListsHint")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {visibleLists.map((list) => (
            <li key={list.id}>
              <SwipeToDeleteRow
                list={list}
                onDeleted={() =>
                  setHiddenIds((prev) => new Set(prev).add(list.id))
                }
              />
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/home"
        className="hl-label text-center text-primary underline"
      >
        {t("common.back")}
      </Link>
    </Screen>
  );
}

/**
 * Swipe-toward-the-end-of-the-line to reveal a Delete button behind the
 * row. Built on CSS scroll-snap rather than tracked pointer events: the
 * "drag" is a real horizontal scroll, so hit-testing, momentum, and
 * RTL mirroring (a swipe reveals on the trailing edge — the right in
 * English/French, the left in Arabic/Urdu) all come from the browser's
 * own scroll engine instead of hand-rolled math. A first version tried
 * tracking pointer events and computing the transform by hand; the
 * Delete button rendered but taps on it did nothing on-device, which
 * reads exactly like a hit-testing gap that custom pointer capture
 * logic is prone to and that native scrolling doesn't have.
 *
 * Deletion itself is `deleteListAction` (archive_list): the same
 * terminal, no-route-back state completing a list already reaches, not
 * a real DELETE of the row — see that RPC's own comment for why.
 */
function SwipeToDeleteRow({
  list,
  onDeleted,
}: {
  list: HouseholdList;
  onDeleted: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  async function handleDelete() {
    if (!window.confirm(t("hlists.deleteConfirm"))) return;
    setDeleting(true);
    const result = await deleteListAction(list.id);
    if (result.ok) {
      onDeleted();
      router.refresh();
    } else {
      setDeleting(false);
      scrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
    }
  }

  return (
    <div className="overflow-hidden rounded-lg">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="w-full shrink-0 snap-start">
          <ListRow list={list} />
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          aria-label={t("hlists.delete")}
          style={{ width: REVEAL_WIDTH }}
          className="hl-label flex shrink-0 snap-end items-center justify-center self-stretch bg-danger text-on-primary disabled:opacity-60"
        >
          {t("hlists.delete")}
        </button>
      </div>
    </div>
  );
}

function ListRow({ list }: { list: HouseholdList }) {
  const { t, locale } = useLocale();

  const total = Number(list.total_items);
  const purchased = Number(list.purchased_items);
  const percent = total ? Math.round((purchased / total) * 100) : 0;
  const isNew = list.status === "sent";

  return (
    <Link
      href={`/home/lists/${list.id}`}
      className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 shadow-sm active:bg-surface-2 ${
        isNew ? "border-primary" : "border-line"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        {/* The Phase 7 acceptance criterion: who sent this. `created_by_name`
            comes from the RPC, because `users` is scoped by RLS to the
            caller's own row and a plain query could not resolve it. */}
        <span className="hl-heading min-w-0 truncate text-ink">
          {t("hlists.from", {
            name: list.created_by_name ?? t("hlists.someone"),
          })}
        </span>
        <span
          className={`hl-caption shrink-0 rounded-pill px-2 py-0.5 ${
            isNew ? "bg-primary text-on-primary" : "bg-surface-2 text-ink-muted"
          }`}
        >
          {t(STATUS_KEYS[list.status] ?? "hlists.statusSent")}
        </span>
      </div>

      {list.sent_at ? (
        <p className="hl-caption">
          {t("hlists.sentAt", {
            when: new Date(list.sent_at).toLocaleString(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }),
          })}
        </p>
      ) : null}

      <Progress purchased={purchased} total={total} percent={percent} />
    </Link>
  );
}

export function Progress({
  purchased,
  total,
  percent,
}: {
  purchased: number;
  total: number;
  percent: number;
}) {
  const { t } = useLocale();

  return (
    <div className="flex flex-col gap-1">
      {/* Item-count based, never quantity-weighted: ten units of one
          product is one checklist item (master plan §16A.6). */}
      <div
        className="h-2 overflow-hidden rounded-pill bg-surface-2"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("hlists.progress", { done: purchased, total })}
      >
        <div
          className="h-full rounded-pill bg-primary-hover"
          style={{ inlineSize: `${percent}%` }}
        />
      </div>
      <p className="hl-caption">
        {t("hlists.progress", { done: purchased, total })}
      </p>
    </div>
  );
}
