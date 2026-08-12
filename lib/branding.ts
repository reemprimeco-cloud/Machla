/**
 * Centralized application branding.
 *
 * Per HomeList_Claude_Code_Master_Plan.md Section 2: "Do not hard-code the
 * brand name throughout the codebase. Store application branding in a
 * centralized configuration." Every screen/metadata/manifest reference to
 * the product name, tagline, or theme color should import from here.
 *
 * Renamed HomeList -> Machla 2026-08-12 (owner decision). The master plan
 * file itself keeps its original filename deliberately — it is the
 * historical brief on record, not a place that gets edited after the fact.
 * This file is the ONE place the new name had to land for the rename to
 * propagate: manifest.ts, metadata, and every screen already read from
 * here rather than hard-coding a string, which is what made the rename a
 * one-file change instead of a grep-and-pray.
 *
 * themeColor/backgroundColor match the design tokens (docs/design/BRAND.md,
 * --hl-green-700 / --hl-bg in app/globals.css) — keep the three in sync if
 * either changes. The CSS custom property PREFIX (--hl-*) was deliberately
 * NOT renamed to --mc-* along with the brand: it is internal, invisible to
 * users, byte-identical in value to the new kit's --mc-* tokens, and a
 * repo-wide rename of every className would have been pure churn with no
 * user-visible benefit.
 */

export const branding = {
  name: "Machla",
  /** Arabic wordmark. Must be set in a face that contains چ (U+0686) — see
   * the "arabic wordmark" note on nameAr's every render site. Tajawal does
   * not have this glyph; IBM Plex Sans Arabic (already the app's Arabic
   * font) does. */
  nameAr: "ماچلة",
  tagline: "One home. Every language.",
  taglineAr: "بيت واحد. كل اللغات.",
  shortName: "Machla",
  description:
    "A simple visual shopping list that connects households with domestic workers, in any language.",
  themeColor: "#1F6B57",
  backgroundColor: "#F7F3EC",
  alternateNames: [
    "HomeList",
    "My Home List",
    "My Prime List",
    "Prime List",
    "My List",
    "Home Grocery List",
  ],
} as const;

export type Branding = typeof branding;
