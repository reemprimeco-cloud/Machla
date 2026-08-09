/**
 * Locale metadata for every language required by
 * HomeList_Claude_Code_Master_Plan.md Section 4.
 *
 * Phase 1 established this as infrastructure only. Phase 2
 * (docs/architecture/15-localization-architecture.md) adds the language
 * selector UI, cookie persistence, and dynamic RTL/LTR document direction
 * on top of it.
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
  /** Name of the language, written in its own script — the primary label on the language card. */
  nativeName: string;
  /** English name, shown only as a small secondary label (never the primary identifier — master plan requirement: don't rely on English labels alone). */
  englishName: string;
  direction: TextDirection;
  /**
   * Optional flag emoji used as an additional visual cue on the language
   * card. Left undefined for languages with no single unambiguous
   * national flag (Telugu, Nepali, Sinhala, Urdu) rather than guessing —
   * the native script itself is the primary visual identifier in that
   * case, per the master plan's own example layout.
   */
  flag?: string;
}

export const LOCALES: readonly LocaleMeta[] = [
  { code: "ar", nativeName: "العربية", englishName: "Arabic", direction: "rtl", flag: "🇸🇦" },
  { code: "en", nativeName: "English", englishName: "English", direction: "ltr", flag: "🇬🇧" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", direction: "ltr", flag: "🇮🇳" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu", direction: "ltr" },
  { code: "ur", nativeName: "اردو", englishName: "Urdu", direction: "rtl" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino", direction: "ltr", flag: "🇵🇭" },
  { code: "ne", nativeName: "नेपाली", englishName: "Nepali", direction: "ltr" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", direction: "ltr", flag: "🇮🇩" },
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
