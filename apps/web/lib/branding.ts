/**
 * Centralized application branding.
 *
 * Per HomeList_Claude_Code_Master_Plan.md Section 2: "Do not hard-code the
 * brand name throughout the codebase. Store application branding in a
 * centralized configuration." Every screen/metadata/manifest reference to
 * the product name, tagline, or theme color should import from here.
 *
 * themeColor/backgroundColor match the HomeList UI Kit design tokens
 * (docs/design/BRAND.md, --hl-green-700 / --hl-bg in app/globals.css) —
 * keep the three in sync if either changes.
 */

export const branding = {
  name: "HomeList",
  tagline: "Your Home. Your List.",
  shortName: "HomeList",
  description:
    "A simple visual shopping list that connects households with domestic workers, in any language.",
  themeColor: "#1F6B57",
  backgroundColor: "#F7F3EC",
  alternateNames: [
    "My Home List",
    "My Prime List",
    "Prime List",
    "My List",
    "Home Grocery List",
  ],
} as const;

export type Branding = typeof branding;
