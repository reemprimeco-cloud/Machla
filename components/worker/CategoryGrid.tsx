"use client";

import Link from "next/link";

import type { Category } from "@/lib/catalog/queries";
import { localizedName } from "@/lib/catalog/localized";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The worker's first screen: large, icon-led tiles.
 *
 * Two columns, not three or four. The target user may have limited
 * literacy in every language on offer, so the icon has to carry as much
 * of the meaning as the label does — which means it has to be big
 * (master plan Section 3: visual navigation is core, not decoration).
 */
export function CategoryGrid({
  categories,
  basePath = "/worker",
  targetListId,
}: {
  categories: Category[];
  basePath?: string;
  /** Carried through to the category page as `?listId=`, so "add more to
   * a sent list" (SentConfirmation.tsx) survives the category tap — see
   * QuantityStepper.tsx's targetListId. Not offered for the photo tile:
   * add_item_to_sent_list has no photo-item counterpart. */
  targetListId?: string;
}) {
  const { locale } = useLocale();

  return (
    <ul className="grid grid-cols-2 gap-3">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            // The capture tile opens the camera instead of a product
            // list; it has no products by design (categories.is_capture).
            href={
              category.is_capture
                ? `${basePath}/photo`
                : targetListId
                  ? `${basePath}/c/${category.key}?listId=${targetListId}`
                  : `${basePath}/c/${category.key}`
            }
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line bg-surface p-3 text-center shadow-sm transition-colors duration-150 ease-hl active:bg-surface-2"
          >
            {/* Fills the card's width, same proportions as a product photo
                (QuantityStepper.tsx's ProductCard) — a fixed small image
                size here read as tiny/lost inside the tile next to how
                big product photos render. Icon fallback lives in the same
                box so every tile is the same height, image or not. */}
            <div className="flex aspect-square w-full items-center justify-center rounded-md bg-surface-2">
              {category.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={category.image_url} alt="" className="size-full rounded-md object-cover" />
              ) : (
                <span aria-hidden className="text-4xl leading-none">
                  {category.icon ?? "📦"}
                </span>
              )}
            </div>
            <span className="hl-label text-ink">
              {localizedName(category, locale)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
