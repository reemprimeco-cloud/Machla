/**
 * The sign-up country picker's option list and its labels.
 *
 * Labels are NOT hand-translated into the 12 locale files — 190-odd
 * country names × 12 languages is a translation burden this single
 * `<select>` doesn't justify, and it would drift out of sync with the
 * ISO list over time. `Intl.DisplayNames` (baseline-available; Safari
 * added it in 2021) already knows every country's name in every locale
 * this app ships, correctly, for free — so the label is generated at
 * render time from the region code rather than stored anywhere.
 *
 * The code list itself is curated, not the full ISO 3166-1 set: a
 * micro-territory someone is vanishingly unlikely to sign up from would
 * only make the picker longer to scroll. Gulf states are pinned first
 * (COUNTRY_CODES_PINNED) since that's where almost every household using
 * this app today actually is (2026-09 request: per-country sign-up
 * counts) — the rest sort alphabetically by their localized name at
 * render time, which is why they aren't pre-sorted here.
 */

export const COUNTRY_CODES_PINNED = ["KW", "SA", "AE", "QA", "BH", "OM"] as const;

export const COUNTRY_CODES_REST = [
  "EG",
  "JO",
  "LB",
  "IQ",
  "SY",
  "YE",
  "PS",
  "MA",
  "DZ",
  "TN",
  "LY",
  "SD",
  "MR",
  "SO",
  "DJ",
  "KM",
  "IN",
  "PK",
  "BD",
  "LK",
  "NP",
  "PH",
  "ID",
  "MY",
  "TH",
  "VN",
  "BJ",
  "NG",
  "GH",
  "KE",
  "ET",
  "TR",
  "IR",
  "AF",
  "US",
  "CA",
  "GB",
  "FR",
  "DE",
  "IT",
  "ES",
  "NL",
  "BE",
  "CH",
  "SE",
  "AU",
  "NZ",
  "ZA",
  "BR",
  "MX",
  "CN",
  "JP",
  "KR",
  "SG",
  "RU",
] as const;

export type CountryCode =
  | (typeof COUNTRY_CODES_PINNED)[number]
  | (typeof COUNTRY_CODES_REST)[number];

export const ALL_COUNTRY_CODES: CountryCode[] = [
  ...COUNTRY_CODES_PINNED,
  ...COUNTRY_CODES_REST,
];

/** Localized display name for a region code, e.g. "Kuwait" (en) /
 * "الكويت" (ar). Falls back to the bare code on a runtime with no
 * `Intl.DisplayNames` (older WebViews) rather than throwing. */
export function countryLabel(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** The rest of the list, sorted by its localized name in the caller's
 * locale — English "Afghanistan"..."Vietnam" reads very differently
 * ordered than the Arabic equivalents would, so this can't be
 * precomputed once for every locale. */
export function sortedRestOfWorld(locale: string): CountryCode[] {
  return [...COUNTRY_CODES_REST].sort((a, b) =>
    countryLabel(a, locale).localeCompare(countryLabel(b, locale), locale),
  );
}
