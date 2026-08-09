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
 * `en` is the canonical key set. Every other locale file is expected to
 * have identical keys (enforced by scripts/check-locales.mjs, run in CI
 * and before every build). getMessages() still deep-merges each locale
 * over the English base as a runtime safety net — a locale missing a key
 * (e.g. a key added but not yet translated) falls back to English for
 * that key alone, rather than rendering blank or crashing.
 */
const RAW_MESSAGES: Record<LocaleCode, Messages> = { ar, en, hi, te, ur, fil, ne, id, si };

export type Messages = typeof en;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMergeOverBase<T>(base: T, overrides: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(overrides)) {
    return (overrides as T) ?? base;
  }
  const result: Record<string, unknown> = { ...base };
  for (const key of Object.keys(base)) {
    result[key] = deepMergeOverBase((base as Record<string, unknown>)[key], overrides[key]);
  }
  return result as T;
}

const MESSAGES: Record<LocaleCode, Messages> = Object.fromEntries(
  Object.entries(RAW_MESSAGES).map(([code, messages]) => [
    code,
    code === DEFAULT_LOCALE ? messages : deepMergeOverBase(en, messages),
  ]),
) as Record<LocaleCode, Messages>;

/** Falls back to the default locale (English) for an entirely unsupported
 * locale code, and to the English value of any individual key that a
 * locale file doesn't (yet) define. */
export function getMessages(locale: string): Messages {
  return isSupportedLocale(locale) ? MESSAGES[locale] : MESSAGES[DEFAULT_LOCALE];
}

// ---- typed dot-path key lookup, e.g. t("common.changeLanguage") ----

type DotPath<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPath<T[K]>}` }[keyof T & string];

export type MessageKey = DotPath<Messages>;

export function getMessage(messages: Messages, key: MessageKey): string {
  const value = (key as string)
    .split(".")
    .reduce<unknown>((acc, part) => {
      if (isPlainObject(acc)) return acc[part];
      return undefined;
    }, messages);
  return typeof value === "string" ? value : key;
}
