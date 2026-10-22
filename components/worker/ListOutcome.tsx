"use client";

import { PhotoThumbnail } from "@/components/photo/PhotoThumbnail";
import { CloseIcon, LeafIcon } from "@/components/ui/Icons";
import { BackLink, Card, Checkbox, Screen } from "@/components/ui/Primitives";
import { localizedName, productDetail } from "@/lib/catalog/localized";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { HouseholdList } from "@/lib/list/household";
import type { ListGroup } from "@/lib/list/queries";

/**
 * A worker's read-only view of what happened to a list she sent — which
 * exact item was bought, which was marked unavailable, not just the
 * aggregate count WorkerHistory.tsx shows (2026-10-22 critique: "one
 * source of truth" only held for the household side before this). No
 * toggle here has a handler: `set_purchase_status` already refuses a
 * Worker caller (assert_can_work_list), so this mirrors that at the UI
 * layer instead of rendering controls that would just fail on tap.
 */
export function ListOutcome({
  summary,
  groups,
}: {
  summary: HouseholdList;
  groups: ListGroup[];
}) {
  const { t, locale } = useLocale();
  const total = Number(summary.total_items);
  const purchased = Number(summary.purchased_items);
  const percent = total ? Math.round((purchased / total) * 100) : 0;

  return (
    <Screen title={t("notif.myLists")}>
      <BackLink href="/worker/lists" label={t("common.back")} />

      <header className="space-y-3">
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

        <div className="rounded-card-sm border border-glass-border bg-glass-bg p-[16px_18px] shadow-card backdrop-blur-[20px]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[15px] font-semibold text-ink">
              {t("hlists.progress", { done: purchased, total })}
            </p>
            <p className="text-[15px] font-bold text-link-accent">{percent}%</p>
          </div>
          <div
            className="mt-2 h-[10px] overflow-hidden rounded-pill bg-track"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("hlists.progress", { done: purchased, total })}
          >
            <div
              className="h-full rounded-pill transition-[inline-size] duration-300 ease-out"
              style={{ inlineSize: `${percent}%`, backgroundImage: "var(--hl-gradient-progress)" }}
            />
          </div>
        </div>
      </header>

      {groups.length === 0 ? (
        <Card>
          <p className="hl-body text-ink-muted">{t("hlists.emptyItems")}</p>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-glass-border bg-glass-bg shadow-card backdrop-blur-[20px]">
          {groups.map((group) => (
            <div key={group.category.id}>
              <div className="flex items-center gap-2 border-b border-divider px-3.5 py-2.5">
                <LeafIcon className="size-4 text-[#1B8A4A]" />
                <h2 className="text-[16px] font-bold text-ink">
                  {localizedName(group.category, locale)}
                </h2>
              </div>

              <ul>
                {group.entries.map(({ item, product, photoUrl }) => (
                  <OutcomeRow
                    key={item.id}
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
                    imageUrl={product?.image_url ?? null}
                    photoUrl={photoUrl}
                    photoPurged={
                      item.photo_path !== null && item.photo_deleted_at !== null
                    }
                    quantity={Number(item.quantity)}
                    unit={item.unit}
                    note={item.note}
                    status={item.purchase_status}
                    addedAfterSend={item.added_by_user_id !== null}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Screen>
  );
}

function OutcomeRow({
  name,
  detail,
  icon,
  imageUrl,
  photoUrl,
  photoPurged,
  quantity,
  unit,
  note,
  status,
  addedAfterSend,
}: {
  name: string;
  detail: string;
  icon: string | null;
  imageUrl: string | null;
  photoUrl: string | null;
  photoPurged: boolean;
  quantity: number;
  unit: string;
  note: string | null;
  status: "pending" | "purchased" | "unavailable";
  addedAfterSend: boolean;
}) {
  const { t } = useLocale();
  const isPurchased = status === "purchased";
  const isUnavailable = status === "unavailable";
  const statusLabel = isPurchased
    ? t("hlists.purchased")
    : isUnavailable
      ? t("hlists.unavailable")
      : null;

  return (
    <li
      className="flex h-[68px] items-center gap-3 border-b border-divider px-3.5 last:border-b-0"
      aria-label={statusLabel ? `${name} — ${statusLabel}` : name}
    >
      <span aria-hidden className="flex shrink-0 items-center">
        <Checkbox checked={isPurchased} />
      </span>

      {photoUrl || photoPurged ? (
        <PhotoThumbnail
          photoUrl={photoUrl}
          purged={photoPurged}
          label={name}
          sizeClassName="size-11"
        />
      ) : imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          className="size-11 shrink-0 rounded-icon object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-icon bg-primary-tint text-2xl leading-none"
        >
          {icon ?? "📦"}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-[16px] font-semibold ${
            isPurchased ? "text-strikethrough-text line-through" : "text-ink"
          } ${isUnavailable ? "text-ink-faint line-through" : ""}`}
        >
          {name}
        </span>
        {detail ? (
          <span className="hl-caption block truncate">{detail}</span>
        ) : null}
        {note ? (
          <span className="hl-caption block truncate">&ldquo;{note}&rdquo;</span>
        ) : null}
        {addedAfterSend ? (
          <span className="hl-caption block text-primary">{t("hlists.addedAfterSend")}</span>
        ) : null}
      </span>

      <span
        dir="ltr"
        className="hl-ltr-num shrink-0 rounded-pill bg-chip-neutral-bg px-2.5 py-1 text-[13px] font-semibold text-chip-neutral-text"
      >
        {quantity} {unit}
      </span>

      {isUnavailable ? (
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-warning text-white"
        >
          <CloseIcon className="size-4" />
        </span>
      ) : null}
    </li>
  );
}
