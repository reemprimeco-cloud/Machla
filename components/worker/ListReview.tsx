"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { PhotoThumbnail } from "@/components/photo/PhotoThumbnail";
import {
  Card,
  ErrorText,
  PrimaryButton,
  Screen,
} from "@/components/ui/Primitives";
import { localizedName, productDetail } from "@/lib/catalog/localized";
import { removePhotoItemAction, sendListAction } from "@/lib/list/actions";
import type { ListErrorCode } from "@/lib/list/errors";
import type { ListGroup } from "@/lib/list/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

import { QuantityStepper } from "./QuantityStepper";
import { WorkerBar } from "./WorkerChrome";

const ERROR_KEYS: Partial<Record<ListErrorCode, MessageKey>> = {
  LIST_NOT_FOUND: "errors.listNotFound",
  LIST_NOT_DRAFT: "errors.listNotDraft",
  LIST_EMPTY: "errors.listEmpty",
  INVALID_QUANTITY: "errors.invalidQuantity",
  PRODUCT_NOT_FOUND: "errors.productNotFound",
};

export function ListReview({
  householdId,
  listId,
  groups,
  itemCount,
  basePath = "/worker",
}: {
  householdId: string;
  listId: string | null;
  groups: ListGroup[];
  itemCount: number;
  basePath?: string;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ListErrorCode | null>(null);

  function send() {
    if (!listId) return;
    setError(null);
    startTransition(async () => {
      const result = await sendListAction(listId);
      if (result.ok) router.push(`${basePath}/sent/${listId}`);
      else setError(result.code);
    });
  }

  return (
    <Screen>
      <WorkerBar
        title={t("worker.myList")}
        backHref={basePath}
        itemCount={itemCount}
        basePath={basePath}
      />

      {itemCount === 0 ? (
        <Card>
          <p className="hl-heading text-ink">{t("worker.emptyList")}</p>
          <p className="hl-caption mt-1">{t("worker.emptyListHint")}</p>
        </Card>
      ) : (
        <>
          {/* One section per category, in aisle order. The grouping comes
              from the item's snapshotted category_id, so what the worker
              reviews here is exactly what the owner will shop from. */}
          {groups.map((group) => (
            <section key={group.category.id} className="space-y-2">
              <h2 className="hl-label text-ink-muted">
                <span aria-hidden className="me-1">
                  {group.category.icon}
                </span>
                {localizedName(group.category, locale)}
              </h2>

              <ul className="space-y-2">
                {group.entries.map(({ item, product, photoUrl }) => {
                  const label = product
                    ? localizedName(product, locale)
                    : t("worker.photoItem");
                  return (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-sand bg-surface p-3 shadow-sm"
                    >
                      {photoUrl ? (
                        <PhotoThumbnail
                          photoUrl={photoUrl}
                          purged={
                            item.photo_path !== null &&
                            item.photo_deleted_at !== null
                          }
                          label={label}
                          sizeClassName="size-14"
                        />
                      ) : (
                        <span aria-hidden className="text-3xl leading-none">
                          {product?.icon ?? group.category.icon ?? "📦"}
                        </span>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="hl-label truncate text-ink">{label}</p>
                        {product ? (
                          <p className="hl-caption truncate">
                            {productDetail(product)}
                          </p>
                        ) : item.note ? (
                          <p className="hl-caption truncate">“{item.note}”</p>
                        ) : null}
                      </div>

                      {product ? (
                        <div className="w-32 shrink-0">
                          <QuantityStepper
                            householdId={householdId}
                            productId={product.id}
                            quantity={Number(item.quantity)}
                            label={localizedName(product, locale)}
                          />
                        </div>
                      ) : (
                        /* A photographed item has no product to step, so the
                         only edit it offers is removal. Quantity is fixed
                         at what was chosen when the photo was added. */
                        <PhotoItemControls
                          itemId={item.id}
                          quantity={Number(item.quantity)}
                          onError={setError}
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <ErrorText>
            {error ? t(ERROR_KEYS[error] ?? "errors.generic") : null}
          </ErrorText>

          <PrimaryButton onClick={send} disabled={pending || !listId}>
            {pending ? t("worker.sending") : t("worker.send")}
          </PrimaryButton>

          <Link href={basePath} className="hl-label text-center text-green-700 underline">
            {t("worker.addMore")}
          </Link>
        </>
      )}
    </Screen>
  );
}

/**
 * The only edit a photographed item offers: remove it.
 *
 * There is no stepper because there is no product to key one on, and the
 * quantity was fixed when the photograph was added. Removal is the
 * escape hatch for "wrong picture", which is the realistic mistake.
 */
function PhotoItemControls({
  itemId,
  quantity,
  onError,
}: {
  itemId: string;
  quantity: number;
  onError: (code: ListErrorCode) => void;
}) {
  const { t } = useLocale();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="hl-label tabular-nums text-ink-muted">{quantity}</span>
      <button
        type="button"
        disabled={pending}
        aria-label={t("worker.photoRemove")}
        onClick={() =>
          startTransition(async () => {
            const result = await removePhotoItemAction(itemId);
            if (!result.ok) onError(result.code);
          })
        }
        className="flex size-12 items-center justify-center rounded-pill border border-sand bg-surface text-lg text-ink disabled:opacity-40"
      >
        <span aria-hidden>✕</span>
      </button>
    </div>
  );
}
