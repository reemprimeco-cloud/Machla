"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";

import { PhotoThumbnail } from "@/components/photo/PhotoThumbnail";
import { Card, ErrorText, PrimaryButton, Screen } from "@/components/ui/Primitives";
import { localizedName, productDetail } from "@/lib/catalog/localized";
import {
  setListCompletedAction,
  setPurchaseStatusAction,
} from "@/lib/list/actions";
import type { ListErrorCode } from "@/lib/list/errors";
import type { HouseholdList } from "@/lib/list/household";
import type { ListGroup } from "@/lib/list/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { PurchaseStatus } from "@/lib/supabase/database.types";

import { Progress } from "./ListsInbox";

const ERROR_KEYS: Partial<Record<ListErrorCode, MessageKey>> = {
  NOT_HOUSEHOLD_SIDE: "errors.notOwner",
  LIST_NOT_FOUND: "errors.listNotFound",
  LIST_NOT_SENT: "errors.listNotFound",
  // Reachable only in a race: someone else archived this list (or it was
  // this tab's own stale copy) between page load and a tap here — the
  // page itself never renders an already-archived list.
  LIST_ARCHIVED: "errors.listNotFound",
};

/**
 * The household's checklist.
 *
 * Grouped by category in aisle order — the same structure the worker
 * reviewed before sending, produced by the same `groupEntries()` — so the
 * two sides cannot drift about what was asked for (§16A.1).
 *
 * What this screen deliberately cannot do: change a quantity, a product,
 * or a note. Those are the *requested* fields, frozen once the list is
 * sent. That is not restraint in the UI — `set_purchase_status` names only
 * the three purchase columns, so there is no request to send that would
 * alter them (§16A.3).
 */
export function ListChecklist({
  summary,
  groups,
  backHref,
}: {
  summary: HouseholdList;
  groups: ListGroup[];
  /** Where this list was opened from (app/home/lists/[id]/page.tsx reads
   * ?from=) — "/home" for the dashboard's own hero card, "/home/lists"
   * for every other entry point, so Back returns to the actual origin
   * instead of always landing on the full list inbox. */
  backHref: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ListErrorCode | null>(null);

  const total = Number(summary.total_items);
  const [purchased, setPurchased] = useOptimistic(
    Number(summary.purchased_items),
  );
  const percent = total ? Math.round((purchased / total) * 100) : 0;

  // Completing a list archives it server-side (set_list_completed,
  // 20260812160000_archive_completed_lists.sql) — it stops being
  // reachable at all, from either side, the moment this succeeds. So
  // there is no "reopen" state to render here any more: this screen can
  // only ever show a list that is still open. Navigate away immediately
  // rather than let the automatic post-action refresh land the user on
  // this same URL's not-found page (getHouseholdListDetail now finds
  // nothing for an archived id).
  function markDone() {
    setError(null);
    startTransition(async () => {
      const result = await setListCompletedAction(summary.id, true);
      if (!result.ok) {
        setError(result.code);
        return;
      }
      router.push(backHref);
    });
  }

  return (
    <Screen>
      <header className="space-y-2">
        <h1 className="hl-title text-ink">
          {t("hlists.from", {
            name: summary.created_by_name ?? t("hlists.someone"),
          })}
        </h1>
        {summary.sent_at ? (
          <p className="hl-caption">
            {t("hlists.sentAt", {
              when: new Date(summary.sent_at).toLocaleString(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        ) : null}
        <Progress purchased={purchased} total={total} percent={percent} />
      </header>

      {groups.length === 0 ? (
        <Card>
          <p className="hl-body text-ink-muted">{t("hlists.emptyItems")}</p>
        </Card>
      ) : (
        groups.map((group) => (
          <section key={group.category.id} className="space-y-2">
            <h2 className="hl-label text-ink-muted">
              <span aria-hidden className="me-1">
                {group.category.icon}
              </span>
              {localizedName(group.category, locale)}
            </h2>

            <ul className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
              {group.entries.map(({ item, product, photoUrl }) => (
                <ChecklistRow
                  key={item.id}
                  itemId={item.id}
                  // A photographed item has no catalogue name to show. The
                  // picture is the name — the label exists for screen
                  // readers and for the case where the image cannot load.
                  name={
                    product
                      ? localizedName(product, locale)
                      : t("worker.photoItem")
                  }
                  detail={product ? productDetail(product) : ""}
                  icon={
                    product
                      ? (product.icon ?? group.category.icon)
                      : group.category.icon
                  }
                  photoUrl={photoUrl}
                  photoPurged={
                    item.photo_path !== null && item.photo_deleted_at !== null
                  }
                  quantity={Number(item.quantity)}
                  unit={item.unit}
                  note={item.note}
                  status={item.purchase_status}
                  onChanged={(before, after) => {
                    // Keep the header count in step with the rows without
                    // a refetch: only transitions into and out of
                    // "purchased" move the number.
                    if (before === after) return;
                    if (after === "purchased") setPurchased(purchased + 1);
                    else if (before === "purchased")
                      setPurchased(purchased - 1);
                  }}
                  onError={setError}
                />
              ))}
            </ul>
          </section>
        ))
      )}

      <ErrorText>
        {error ? t(ERROR_KEYS[error] ?? "errors.generic") : null}
      </ErrorText>

      {groups.length > 0 ? (
        // Deliberately not gated on every item being checked: a shop can
        // finish with something unavailable, and refusing to close the
        // list would only teach people to fake the boxes.
        <PrimaryButton onClick={markDone} disabled={pending}>
          {t("hlists.markDone")}
        </PrimaryButton>
      ) : null}

      <Link
        href={backHref}
        className="hl-label text-center text-primary underline"
      >
        {t("common.back")}
      </Link>
    </Screen>
  );
}

function ChecklistRow({
  itemId,
  name,
  detail,
  icon,
  photoUrl,
  photoPurged,
  quantity,
  unit,
  note,
  status,
  onChanged,
  onError,
}: {
  itemId: string;
  name: string;
  detail: string;
  icon: string | null;
  photoUrl: string | null;
  photoPurged: boolean;
  quantity: number;
  unit: string;
  note: string | null;
  status: PurchaseStatus;
  onChanged: (before: PurchaseStatus, after: PurchaseStatus) => void;
  onError: (code: ListErrorCode) => void;
}) {
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);

  function change(next: PurchaseStatus) {
    const before = optimisticStatus;
    startTransition(async () => {
      setOptimisticStatus(next);
      onChanged(before, next);
      const result = await setPurchaseStatusAction(itemId, next);
      if (!result.ok) onError(result.code);
    });
  }

  const isPurchased = optimisticStatus === "purchased";
  const isUnavailable = optimisticStatus === "unavailable";

  return (
    <li className="border-b border-line last:border-b-0">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Checkbox + text are still one big toggle target, split either
            side of the photo — which needs its own tap target now that it
            opens full-size (PhotoThumbnail) rather than being decoration
            inside this button. Nesting a <button> inside a <button> is
            invalid HTML and unreliable to click, hence the split. */}
        <button
          type="button"
          onClick={() => change(isPurchased ? "pending" : "purchased")}
          aria-pressed={isPurchased}
          aria-label={`${t("hlists.purchased")} — ${name}`}
          className="flex min-h-12 shrink-0 items-center"
        >
          <span
            aria-hidden
            className={`flex size-9 items-center justify-center rounded-pill border-2 text-base ${
              isPurchased
                ? "border-primary bg-primary text-on-primary"
                : "border-line bg-surface text-transparent"
            }`}
          >
            ✓
          </span>
        </button>

        {photoUrl || photoPurged ? (
          <PhotoThumbnail
            photoUrl={photoUrl}
            purged={photoPurged}
            label={name}
            sizeClassName="size-14"
          />
        ) : (
          <span aria-hidden className="shrink-0 text-2xl leading-none">
            {icon ?? "📦"}
          </span>
        )}

        <button
          type="button"
          onClick={() => change(isPurchased ? "pending" : "purchased")}
          aria-pressed={isPurchased}
          aria-label={`${t("hlists.purchased")} — ${name}`}
          className="flex min-h-12 flex-1 items-center gap-3 text-start"
        >
          <span className="min-w-0 flex-1">
            <span
              className={`hl-body block truncate ${
                isPurchased ? "text-ink-muted line-through" : "text-ink"
              } ${isUnavailable ? "text-ink-faint line-through" : ""}`}
            >
              {name}
            </span>
            {detail ? (
              <span className="hl-caption block truncate">{detail}</span>
            ) : null}
            {note ? (
              <span className="hl-caption block truncate">“{note}”</span>
            ) : null}
          </span>

          <span className="hl-label shrink-0 tabular-nums text-ink-muted">
            {quantity} {unit}
          </span>
        </button>

        <button
          type="button"
          onClick={() => change(isUnavailable ? "pending" : "unavailable")}
          aria-pressed={isUnavailable}
          aria-label={`${t("hlists.unavailable")} — ${name}`}
          className={`flex size-12 shrink-0 items-center justify-center rounded-pill border text-lg ${
            isUnavailable
              ? "border-warning bg-warning text-white"
              : "border-line bg-surface"
          }`}
        >
          <span aria-hidden>✕</span>
        </button>
      </div>
    </li>
  );
}
