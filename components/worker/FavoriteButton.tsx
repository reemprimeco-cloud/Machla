"use client";

import { useOptimistic, useTransition } from "react";

import { HeartIcon } from "@/components/ui/Icons";
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
      className={`absolute end-1 top-1 flex size-11 items-center justify-center rounded-pill bg-surface/90 shadow-sm transition-transform duration-150 ease-hl active:scale-90 ${
        isFavorite ? "text-danger" : "text-ink-muted"
      }`}
    >
      {/* Keyed on isFavorite so the icon remounts and replays the pop on
          every toggle, not just the first time it becomes true (2026-10-22
          critique: this was the one conventionally-animated pattern in
          mobile design that was fully static here). */}
      <HeartIcon key={String(isFavorite)} filled={isFavorite} className="hl-pop-in size-5" />
    </button>
  );
}
