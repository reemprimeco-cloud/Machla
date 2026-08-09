"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Card, ErrorText, PrimaryButton, Screen } from "@/components/ui/Primitives";
import { localizedName, productDetail } from "@/lib/catalog/localized";
import { sendListAction } from "@/lib/list/actions";
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
}: {
  householdId: string;
  listId: string | null;
  groups: ListGroup[];
  itemCount: number;
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
      if (result.ok) router.push(`/worker/sent/${listId}`);
      else setError(result.code);
    });
  }

  return (
    <Screen>
      <WorkerBar title={t("worker.myList")} backHref="/worker" itemCount={itemCount} />

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
                {group.entries.map(({ item, product }) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-lg border border-sand bg-surface p-3 shadow-sm"
                  >
                    <span aria-hidden className="text-3xl leading-none">
                      {group.category.icon ?? "📦"}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="hl-label truncate text-ink">
                        {localizedName(product, locale)}
                      </p>
                      <p className="hl-caption truncate">{productDetail(product)}</p>
                    </div>

                    <div className="w-32 shrink-0">
                      <QuantityStepper
                        householdId={householdId}
                        productId={product.id}
                        quantity={Number(item.quantity)}
                        label={localizedName(product, locale)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          <ErrorText>{error ? t(ERROR_KEYS[error] ?? "errors.generic") : null}</ErrorText>

          <PrimaryButton onClick={send} disabled={pending || !listId}>
            {pending ? t("worker.sending") : t("worker.send")}
          </PrimaryButton>

          <Link href="/worker" className="hl-label text-center text-green-700 underline">
            {t("worker.addMore")}
          </Link>
        </>
      )}
    </Screen>
  );
}
