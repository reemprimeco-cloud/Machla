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
}: {
  categories: Category[];
  basePath?: string;
}) {
  const { locale } = useLocale();

  return (
    <ul className="grid grid-cols-2 gap-3">
      {categories.map((category) => (
        <li key={category.id}>
          <Link
            // The capture tile opens the camera instead of a product
            // list; it has no products by design (categories.is_capture).
            href={category.is_capture ? `${basePath}/photo` : `${basePath}/c/${category.key}`}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-lg border border-sand bg-surface px-3 py-4 text-center shadow-sm transition-colors duration-150 ease-hl active:bg-surface-2"
          >
            <span aria-hidden className="text-4xl leading-none">
              {category.icon ?? "📦"}
            </span>
            <span className="hl-label text-ink">{localizedName(category, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
