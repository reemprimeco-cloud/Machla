"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Card, Screen } from "@/components/ui/Primitives";
import { deleteListAction } from "@/lib/list/actions";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/** How far a row slides to reveal the Delete button, in px — also the
 * threshold past which releasing the swipe snaps it open rather than
 * springing back. */
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
 * row, mirroring correctly in RTL via `direction` rather than assuming
 * "left" — a swipe gesture always reveals on the trailing edge, which is
 * the right in English/French but the left in Arabic/Urdu.
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
  const { t, direction } = useLocale();
  const router = useRouter();
  const isRTL = direction === "rtl";

  const [dragX, setDragX] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const startX = useRef<number | null>(null);
  const dragged = useRef(false);

  // Positive = revealed toward the trailing edge, regardless of writing
  // direction — everything below works in this space and flips to a
  // real translateX only at render time. dragX is the raw delta since
  // pointerdown; resting position (0 or REVEAL_WIDTH) is added to it and
  // the sum is clamped to a valid reveal amount.
  const offset = Math.max(0, Math.min(REVEAL_WIDTH, (revealed ? REVEAL_WIDTH : 0) + dragX));

  function handlePointerDown(event: React.PointerEvent) {
    if (deleting) return;
    startX.current = event.clientX;
    dragged.current = false;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (startX.current === null) return;
    const raw = event.clientX - startX.current;
    // Swiping toward the trailing edge is a leftward drag in LTR, a
    // rightward drag in RTL — normalize both to the same positive sign.
    const trailing = isRTL ? raw : -raw;
    if (Math.abs(trailing) > 4) dragged.current = true;
    setDragX(trailing);
  }

  function endDrag() {
    if (startX.current === null) return;
    startX.current = null;
    setRevealed(offset > REVEAL_WIDTH / 2);
    setDragX(0);
  }

  async function handleDelete() {
    if (!window.confirm(t("hlists.deleteConfirm"))) return;
    setDeleting(true);
    const result = await deleteListAction(list.id);
    if (result.ok) {
      onDeleted();
      router.refresh();
    } else {
      setDeleting(false);
      setRevealed(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        aria-label={t("hlists.delete")}
        className="hl-label absolute inset-y-0 flex items-center justify-center bg-danger text-on-primary disabled:opacity-60"
        style={{ [isRTL ? "left" : "right"]: 0, width: REVEAL_WIDTH }}
      >
        {t("hlists.delete")}
      </button>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(event) => {
          // A drag that moved the row is a swipe, not a tap — stop the
          // inner <Link> from navigating once the gesture is done.
          if (dragged.current) event.preventDefault();
        }}
        style={{
          transform: `translateX(${isRTL ? offset : -offset}px)`,
          touchAction: "pan-y",
        }}
        className="transition-transform duration-150 ease-hl"
      >
        <ListRow list={list} />
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
