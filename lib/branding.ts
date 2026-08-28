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
 * --hl-primary / --hl-bg in app/globals.css) — keep the three in sync if
 * either changes. The CSS custom property PREFIX (--hl-*) was deliberately
 * NOT renamed to --mc-* along with the 2026-08 visual renovation (the new
 * Machla UI Kit's gradient mark, magenta-to-amber ramp, navy ink): it is
 * internal, invisible to users, byte-identical in value to the kit's
 * --mc-* tokens, and a repo-wide rename of every className would have been
 * pure churn with no user-visible benefit. What DID need renaming — every
 * Tailwind utility that baked a literal old colour into its name
 * (bg-green-700, border-sand, text-cream, ...) — was renamed, because
 * leaving `bg-green-700` rendering pink is exactly the kind of misleading
 * code this project's own conventions rule out.
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
  /** The one inbox anyone contacting this project reaches — App Store
   * Connect's Support URL field, /support, and everywhere else "contact
   * us" needs an address. */
  supportEmail: "reemprimeco@gmail.com",
  themeColor: "#E01B6A",
  backgroundColor: "#F7F8FA",
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
