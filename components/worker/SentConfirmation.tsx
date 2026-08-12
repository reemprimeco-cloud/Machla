"use client";

import Link from "next/link";

import { PhotoThumbnail } from "@/components/photo/PhotoThumbnail";
import { Card, Screen } from "@/components/ui/Primitives";
import { localizedName } from "@/lib/catalog/localized";
import type { ListGroup } from "@/lib/list/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Confirmation that the list reached the household.
 *
 * Deliberately shows the list back, grouped as it was sent, rather than
 * only a success tick: the worker's own record of what they asked for is
 * the thing that settles a later disagreement, and a tick alone would
 * make them re-open the app to check.
 */
export function SentConfirmation({
  householdName,
  groups,
  itemCount,
  basePath = "/worker",
}: {
  householdName: string;
  groups: ListGroup[];
  itemCount: number;
  basePath?: string;
}) {
  const { t, locale } = useLocale();

  return (
    <Screen>
      <Card className="text-center">
        <p aria-hidden className="text-5xl leading-none">
          ✅
        </p>
        <p className="hl-title mt-3 text-ink">{t("worker.sentTitle")}</p>
        <p className="hl-caption mt-1">{t("worker.sentHint")}</p>
        <p className="hl-caption mt-1">{householdName}</p>
      </Card>

      <p className="hl-label text-ink-muted">
        {t("worker.myListWithCount", { count: itemCount })}
      </p>

      {groups.map((group) => (
        <section key={group.category.id} className="space-y-1">
          <h2 className="hl-label text-ink-muted">
            <span aria-hidden className="me-1">
              {group.category.icon}
            </span>
            {localizedName(group.category, locale)}
          </h2>
          <ul className="rounded-lg border border-line bg-surface shadow-sm">
            {group.entries.map(({ item, product, photoUrl }) => {
              const label = product
                ? localizedName(product, locale)
                : t("worker.photoItem");
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  {photoUrl ||
                  (item.photo_path !== null &&
                    item.photo_deleted_at !== null) ? (
                    <PhotoThumbnail
                      photoUrl={photoUrl}
                      purged={
                        item.photo_path !== null &&
                        item.photo_deleted_at !== null
                      }
                      label={label}
                      sizeClassName="size-10"
                    />
                  ) : null}
                  <span className="hl-body min-w-0 flex-1 truncate text-ink">
                    {label}
                  </span>
                  <span className="hl-label shrink-0 tabular-nums text-ink-muted">
                    {Number(item.quantity)} {item.unit}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <Link
        href={basePath}
        className="hl-label min-h-12 content-center rounded-lg bg-primary px-4 text-center text-on-primary shadow-sm"
      >
        {t("worker.newList")}
      </Link>
    </Screen>
  );
}
