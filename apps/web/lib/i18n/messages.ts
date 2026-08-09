import type { LocaleCode } from "./config";
import { DEFAULT_LOCALE, isSupportedLocale } from "./config";

import ar from "@/locales/ar.json";
import en from "@/locales/en.json";
import fil from "@/locales/fil.json";
import hi from "@/locales/hi.json";
import id from "@/locales/id.json";
import ne from "@/locales/ne.json";
import si from "@/locales/si.json";
import te from "@/locales/te.json";
import ur from "@/locales/ur.json";

/**
 * UI translation source of truth. Product/catalog names are stored in the
 * database (docs/architecture/03-database-schema.md), never here — this
 * file is app-chrome strings only, per master plan Section 4: "UI
 * translations should be stored in structured locale files."
 *
 * Phase 1 seeds only the handful of keys needed for the placeholder shell.
 * Phase 2 expands coverage to the full worker/household UI.
 */
const MESSAGES: Record<LocaleCode, Messages> = { ar, en, hi, te, ur, fil, ne, id, si };

export type Messages = typeof en;

/** Falls back to the default locale (English) if a locale's messages are
 * missing entirely — the per-key fallback chain is a Phase 2 concern once
 * there are enough keys for partial coverage to be a real scenario. */
export function getMessages(locale: string): Messages {
  return isSupportedLocale(locale) ? MESSAGES[locale] : MESSAGES[DEFAULT_LOCALE];
}
