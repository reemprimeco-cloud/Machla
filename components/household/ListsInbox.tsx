"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, ErrorText, Screen } from "@/components/ui/Primitives";
import { deleteListAction } from "@/lib/list/actions";
import type { ListErrorCode } from "@/lib/list/errors";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const DELETE_ERROR_KEYS: Partial<Record<ListErrorCode, MessageKey>> = {
  LIST_NOT_FOUND: "errors.listNotFound",
  LIST_ARCHIVED: "errors.listNotFound",
  NOT_HOUSEHOLD_SIDE: "errors.notOwner",
};

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
              <DeletableRow
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
 * A list row plus a delete control.
 *
 * Two earlier versions hid the delete button behind a swipe gesture — one
 * with hand-rolled pointer events, one with CSS scroll-snap, both inside
 * an `overflow-x` scroll container, which iOS WKWebView is known to
 * swallow clicks inside. A third version moved the button outside any
 * scroll container, which fixed that — but confirmed via window.confirm
 * NEVER appearing on-device even so, this used window.confirm() to ask
 * before deleting, exactly like every other destructive action in this
 * app. That native dialog is mediated by the iOS shell's WKUIDelegate
 * (ios/Machla/WebAppView.swift) rather than the web page itself, and on
 * this exact screen it never appeared at all, with no error reaching
 * either Vercel's or Supabase's logs to explain why. Rather than debug a
 * native bridge blind, the confirmation step is now plain React state —
 * tapping delete once reveals inline Cancel/Delete controls, no native
 * dialog involved at any point.
 *
 * Deletion itself is `deleteListAction` (archive_list): the same
 * terminal, no-route-back state completing a list already reaches, not
 * a real DELETE of the row — see that RPC's own comment for why.
 */
function DeletableRow({
  list,
  onDeleted,
}: {
  list: HouseholdList;
  onDeleted: () => void;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<ListErrorCode | null>(null);

  async function handleConfirmedDelete() {
    setDeleting(true);
    setError(null);
    const result = await deleteListAction(list.id);
    if (result.ok) {
      onDeleted();
      router.refresh();
    } else {
      setDeleting(false);
      setConfirming(false);
      setError(result.code);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-2">
        <div className="min-w-0 flex-1">
          <ListRow list={list} />
        </div>
        {confirming ? (
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              onClick={handleConfirmedDelete}
              disabled={deleting}
              className="hl-caption flex-1 rounded-lg bg-danger px-3 py-1 text-on-primary disabled:opacity-60"
            >
              {t("hlists.delete")}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="hl-caption flex-1 rounded-lg border border-line bg-surface px-3 py-1 text-ink-muted disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label={t("hlists.delete")}
            className="flex w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-xl text-danger active:bg-surface-2"
          >
            <span aria-hidden>🗑️</span>
          </button>
        )}
      </div>
      {confirming ? (
        <p className="hl-caption text-ink-muted">{t("hlists.deleteConfirm")}</p>
      ) : null}
      {error ? (
        <ErrorText>{t(DELETE_ERROR_KEYS[error] ?? "errors.generic")}</ErrorText>
      ) : null}
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
