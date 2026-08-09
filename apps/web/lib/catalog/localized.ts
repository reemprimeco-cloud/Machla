import type { LocaleCode } from "@/lib/i18n/config";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

/**
 * Picking the right localized column off a catalogue row.
 *
 * Product and category names are stored as nine real columns
 * (`name_en` … `name_si`), not as UI translation keys — they are *data*,
 * curated offline, and they change without a deploy
 * (docs/architecture/11-product-catalog-architecture.md §7,
 * 15-localization-architecture.md). So they never go through `t()`;
 * they are selected here instead.
 *
 * Shared by server and client components, hence no "server-only".
 */

/** The nine name columns every catalogue row carries. */
export type LocalizedNames = {
  [K in `name_${LocaleCode}`]: string;
};

export function localizedName(row: LocalizedNames, locale: LocaleCode): string {
  // Every row is validated to carry all nine names before import
  // (catalog-import/scripts/build-catalog.mjs), so the fallback is a
  // belt-and-braces guard against a row written outside that pipeline —
  // an untranslated name is far better than a blank card.
  return row[`name_${locale}`] || row[`name_${DEFAULT_LOCALE}`] || "";
}

/** Brand + size, the line under a product's name. Both are optional and
 * deliberately NOT translated: "Almarai" and "1 L" read the same in every
 * language, and transliterating a brand would make it unrecognisable on
 * the shelf. */
export function productDetail(row: { brand: string | null; size: string | null }): string {
  return [row.brand, row.size].filter(Boolean).join(" · ");
}
