import type { CatalogLocaleCode, LocaleCode } from "@/lib/i18n/config";
import { DEFAULT_LOCALE, toCatalogLocale } from "@/lib/i18n/config";

/**
 * Picking the right localized column off a catalogue row.
 *
 * Product and category names are stored as real columns
 * (`name_en` … `name_fon`), not as UI translation keys — they are *data*,
 * curated offline, and they change without a deploy
 * (docs/architecture/11-product-catalog-architecture.md §7,
 * 15-localization-architecture.md). So they never go through `t()`;
 * they are selected here instead.
 *
 * Shared by server and client components, hence no "server-only".
 */

/** The name columns a catalogue row carries. Nine are guaranteed
 * (`name_en` … `name_si`, NOT NULL and validated before import); the
 * three added with the twelve-language expansion are nullable and filled
 * in per row as translation progresses — hence the `| null`. */
export type LocalizedNames = {
  [K in `name_${CatalogLocaleCode}`]: string | null;
};

export function localizedName(row: LocalizedNames, locale: LocaleCode): string {
  const catalogLocale = toCatalogLocale(locale);
  // Falls back to English for a row not yet translated into this locale
  // (name_am/name_fr/name_fon are nullable by design), and as a
  // belt-and-braces guard for a row written outside the import pipeline.
  // An untranslated name is far better than a blank card.
  return row[`name_${catalogLocale}`] || row[`name_${toCatalogLocale(DEFAULT_LOCALE)}`] || "";
}

/** Brand + size, the line under a product's name. Both are optional and
 * deliberately NOT translated: "Almarai" and "1 L" read the same in every
 * language, and transliterating a brand would make it unrecognisable on
 * the shelf. */
export function productDetail(row: { brand: string | null; size: string | null }): string {
  return [row.brand, row.size].filter(Boolean).join(" · ");
}
