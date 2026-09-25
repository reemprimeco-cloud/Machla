"use client";

import { useOptimistic, useTransition } from "react";

import { toggleFavoriteAction } from "@/lib/favorites/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** The heart on a product card — one implicit favorites list per
 * person, no naming, no picker (simplified version the owner chose).
 * Positioned opposite the price badge (QuantityStepper.tsx's
 * ProductCard), so the two never collide even when both are present. */
export function FavoriteButton({
  productId,
  initialIsFavorite,
}: {
  productId: string;
  initialIsFavorite: boolean;
}) {
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const [isFavorite, setOptimisticIsFavorite] = useOptimistic(initialIsFavorite);

  function toggle() {
    const next = !isFavorite;
    startTransition(async () => {
      setOptimisticIsFavorite(next);
      await toggleFavoriteAction(productId);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isFavorite ? t("worker.removeFromFavorites") : t("worker.addToFavorites")}
      aria-pressed={isFavorite}
      className="absolute end-1.5 top-1.5 flex size-7 items-center justify-center rounded-pill bg-surface/90 text-base leading-none shadow-sm"
    >
      <span aria-hidden>{isFavorite ? "❤️" : "🤍"}</span>
    </button>
  );
}
