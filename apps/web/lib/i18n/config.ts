/**
 * Locale metadata for every language required by
 * HomeList_Claude_Code_Master_Plan.md Section 4.
 *
 * Phase 1 established this as infrastructure only. Phase 2
 * (docs/architecture/15-localization-architecture.md) added the language
 * selector UI, cookie persistence, and dynamic RTL/LTR document direction
 * on top of it. This file's flag/script metadata was subsequently aligned
 * to the HomeList UI Kit (docs/design/BRAND.md) — see
 * 15-localization-architecture.md §9 for the full rationale.
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

/**
 * Writing system, driving both which webfont renders the script
 * (globals.css `[data-script=...]` rules) and its required line-height.
 * `arabic` and `nastaliq` are both Arabic-alphabet but distinct: Urdu is
 * set in Nastaliq app-wide once active, but rendered in the plainer Naskh
 * (`arabic`) style within the language picker itself, where a tall
 * Nastaliq line would break the card grid — see LanguagePicker.
 */
export type Script = "latin" | "arabic" | "nastaliq" | "devanagari" | "telugu" | "sinhala";

export interface LocaleMeta {
  code: LocaleCode;
  /** Name of the language, written in its own script — the primary label on the language card. */
  nativeName: string;
  /** English name, shown only as a small secondary label (never the primary identifier — master plan requirement: don't rely on English labels alone). */
  englishName: string;
  direction: TextDirection;
  script: Script;
  /**
   * ISO 3166-1 alpha-2 of the flag shown (matches a file in
   * public/flags/<code>.svg), or `null` when no single national flag
   * unambiguously identifies the language — the native script badge is
   * used instead. Flags are decoration, never a lookup key.
   *
   * ar -> kw, not sa: the Saudi flag carries the shahada, and Saudi
   *       regulation restricts its decorative/commercial reproduction —
   *       a language-picker tile is decorative use. Kuwait is also the
   *       correct market signal for this product.
   * te, si -> null: Telugu and Hindi are both India; two identical India
   *       flags in one list reads as a rendering bug, so Telugu shows its
   *       script glyph instead. The Sri Lankan lion is unreadable below
   *       ~40px, so Sinhala does the same.
   * ur -> pk: Urdu has no flag of its own; Pakistan is its primary
   *       national association.
   */
  flagIso: string | null;
}

export const LOCALES: readonly LocaleMeta[] = [
  { code: "ar", nativeName: "العربية", englishName: "Arabic", direction: "rtl", script: "arabic", flagIso: "kw" },
  { code: "en", nativeName: "English", englishName: "English", direction: "ltr", script: "latin", flagIso: "gb" },
  { code: "hi", nativeName: "हिन्दी", englishName: "Hindi", direction: "ltr", script: "devanagari", flagIso: "in" },
  { code: "te", nativeName: "తెలుగు", englishName: "Telugu", direction: "ltr", script: "telugu", flagIso: null },
  { code: "ur", nativeName: "اردو", englishName: "Urdu", direction: "rtl", script: "nastaliq", flagIso: "pk" },
  { code: "fil", nativeName: "Filipino", englishName: "Filipino", direction: "ltr", script: "latin", flagIso: "ph" },
  { code: "ne", nativeName: "नेपाली", englishName: "Nepali", direction: "ltr", script: "devanagari", flagIso: "np" },
  { code: "id", nativeName: "Bahasa Indonesia", englishName: "Indonesian", direction: "ltr", script: "latin", flagIso: "id" },
  { code: "si", nativeName: "සිංහල", englishName: "Sinhala", direction: "ltr", script: "sinhala", flagIso: null },
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

export function scriptFor(code: string): Script {
  return getLocaleMeta(code).script;
}

/** The script used to render this language's OWN native name inside the
 * language picker, which may differ from `scriptFor` — see the Script
 * type's doc comment (Urdu: nastaliq app-wide, but arabic/naskh in the
 * picker card). */
export function pickerScriptFor(code: string): Script {
  const script = scriptFor(code);
  return script === "nastaliq" ? "arabic" : script;
}
