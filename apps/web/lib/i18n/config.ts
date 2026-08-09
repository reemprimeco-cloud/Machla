/**
 * Locale metadata for every language required by
 * HomeList_Claude_Code_Master_Plan.md Section 4.
 *
 * This is infrastructure only (Phase 1 "centralized localization system"
 * foundation task). The language selector UI, persistence, and full RTL
 * layout work is Phase 2 (docs/architecture/09-folder-structure.md,
 * master plan Phase 2).
 */

export type LocaleCode =
  | "ar"
  | "en"
  | "hi"
  | "te"
  | "ur"
  | "fil"
  | "ne"
  | "id"
  | "si";

export type TextDirection = "ltr" | "rtl";

export interface LocaleMeta {
  code: LocaleCode;
  /** Name of the language, written in its own script. */
  nativeName: string;
  /** English name, for admin/debugging contexts only — never shown as the primary label to end users. */
  englishName: string;
  direction: TextDirection;
}

export const LOCALES: readonly LocaleMeta[] = [
  { code: "ar", nativeName: "العربية", englishName: "Arabic", direction: "rtl" },
  { code: "en", nativeName: "English", englishName: "English", direction: "ltr" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", direction: "ltr" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu", direction: "ltr" },
  { code: "ur", nativeName: "اردو", englishName: "Urdu", direction: "rtl" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino", direction: "ltr" },
  { code: "ne", nativeName: "नेपाली", englishName: "Nepali", direction: "ltr" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", direction: "ltr" },
  { code: "si", nativeName: "සිංහල", englishName: "Sinhala", direction: "ltr" },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "en";

/** Per docs/architecture/14-technical-risks-decisions.md item 7: Owner/Member
 * accounts may only choose Arabic or English (master plan Section 21).
 * Workers may choose any supported locale. Enforced at the application
 * layer, not the database, so it can be revisited without a migration. */
export const HOUSEHOLD_DISPLAY_LOCALES: readonly LocaleCode[] = ["ar", "en"];

const LOCALE_BY_CODE = new Map(LOCALES.map((locale) => [locale.code, locale]));

export function getLocaleMeta(code: string): LocaleMeta {
  return LOCALE_BY_CODE.get(code as LocaleCode) ?? LOCALE_BY_CODE.get(DEFAULT_LOCALE)!;
}

export function isSupportedLocale(code: string): code is LocaleCode {
  return LOCALE_BY_CODE.has(code as LocaleCode);
}

export function directionFor(code: string): TextDirection {
  return getLocaleMeta(code).direction;
}
