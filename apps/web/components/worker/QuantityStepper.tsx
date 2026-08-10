"use client";

import { useOptimistic, useTransition } from "react";

import { localizedName, productDetail } from "@/lib/catalog/localized";
import type { Product } from "@/lib/catalog/queries";
import { setProductQuantityAction } from "@/lib/list/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The single control the whole shopping flow runs on.
 *
 * At zero it is one big "Add" button; above zero it becomes − N +. Both
 * states occupy the same footprint so the card does not jump when tapped,
 * and every target clears the 48px minimum in globals.css (--hl-tap-min):
 * this is used one-handed, often in a cold aisle.
 *
 * Updates are optimistic. On a poor connection the round trip is slow
 * enough that an un-acknowledged tap reads as broken and gets tapped
 * again — which would be a real bug if it double-added. It cannot: the
 * server sets an absolute quantity rather than incrementing, so a repeat
 * of the same tap is idempotent.
 */
export function QuantityStepper({
  householdId,
  productId,
  quantity,
  label,
}: {
  householdId: string;
  productId: string;
  quantity: number;
  label: string;
}) {
  const { t, locale } = useLocale();
  const [, startTransition] = useTransition();
  const [optimisticQuantity, setOptimisticQuantity] = useOptimistic(quantity);

  function change(next: number) {
    const clamped = Math.max(0, Math.min(999, next));
    startTransition(async () => {
      setOptimisticQuantity(clamped);
      await setProductQuantityAction(householdId, productId, clamped, locale);
    });
  }

  if (optimisticQuantity <= 0) {
    return (
      <button
        type="button"
        onClick={() => change(1)}
        aria-label={`${t("worker.add")} — ${label}`}
        className="hl-label min-h-12 w-full rounded-pill bg-green-700 px-4 text-on-green transition-colors duration-150 ease-hl active:bg-green-600"
      >
        {t("worker.add")}
      </button>
    );
  }

  return (
    <div className="flex min-h-12 items-center justify-between gap-2 rounded-pill border border-green-700 bg-green-100 px-1">
      <StepButton
        onClick={() => change(optimisticQuantity - 1)}
        label={`${optimisticQuantity <= 1 ? t("worker.remove") : "−"} — ${label}`}
        glyph={optimisticQuantity <= 1 ? "🗑" : "−"}
      />
      <span className="hl-label tabular-nums text-ink" aria-live="polite">
        {optimisticQuantity}
      </span>
      <StepButton
        onClick={() => change(optimisticQuantity + 1)}
        label={`+ — ${label}`}
        glyph="+"
      />
    </div>
  );
}

function StepButton({
  onClick,
  label,
  glyph,
}: {
  onClick: () => void;
  label: string;
  glyph: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex size-11 items-center justify-center rounded-pill bg-surface text-lg leading-none text-ink shadow-sm"
    >
      <span aria-hidden>{glyph}</span>
    </button>
  );
}

/**
 * A product tile: picture, name, brand/size, stepper.
 *
 * `image_url` is null for every row in the Phase 5 catalogue — no
 * third-party product photography was re-hosted
 * (11-product-catalog-architecture.md §7.5) — so the category icon stands
 * in. That is the designed fallback, not a placeholder for missing work:
 * a large familiar glyph is more use to a low-literacy shopper than a
 * broken image frame.
 */
export function ProductCard({
  product,
  householdId,
  quantity,
  categoryIcon,
}: {
  product: Product;
  householdId: string;
  quantity: number;
  categoryIcon: string | null;
}) {
  const { locale } = useLocale();
  const name = localizedName(product, locale);
  const detail = productDetail(product);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-sand bg-surface p-3 shadow-sm">
      <div className="flex aspect-square items-center justify-center rounded-md bg-surface-2">
        {product.image_url ? (
          // Catalogue images are arbitrary remote URLs, set by the offline
          // importer without a redeploy. next/image would need every host
          // allow-listed in next.config at build time, which would make
          // adding a photo a code change — exactly what
          // 11-product-catalog-architecture.md §7 sets out to avoid.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt="" className="size-full rounded-md object-cover" />
        ) : (
          // icon → category icon → box. The per-type icon is what stops a
          // category page being 24 identical tiles; the category icon is
          // only reached by a row written outside the import pipeline.
          <span aria-hidden className="text-5xl leading-none">
            {product.icon ?? categoryIcon ?? "📦"}
          </span>
        )}
      </div>

      <div className="min-h-12">
        <p className="hl-label text-ink">{name}</p>
        {detail ? <p className="hl-caption">{detail}</p> : null}
      </div>

      <QuantityStepper
        householdId={householdId}
        productId={product.id}
        quantity={quantity}
        label={name}
      />
    </li>
  );
}

export function ProductGrid({
  products,
  householdId,
  quantities,
  iconByCategoryId,
}: {
  products: Product[];
  householdId: string;
  quantities: Record<string, number>;
  iconByCategoryId: Record<string, string | null>;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          householdId={householdId}
          quantity={quantities[product.id] ?? 0}
          categoryIcon={iconByCategoryId[product.category_id] ?? null}
        />
      ))}
    </ul>
  );
}
