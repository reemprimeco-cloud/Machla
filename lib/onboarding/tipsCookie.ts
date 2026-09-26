/**
 * "How it works" tutorial persistence (app/tips).
 *
 * Shown once, right after the language is chosen and before sign-in/up —
 * there's no user yet at that point, so (same reasoning as
 * lib/i18n/cookie.ts) a plain readable cookie is the only place to
 * remember it was seen, checked from the server in app/page.tsx.
 */

export const TIPS_SEEN_COOKIE_NAME = "machla_tips_seen";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function writeTipsSeenCookieClient(): void {
  if (typeof document === "undefined") return;

  document.cookie = `${TIPS_SEEN_COOKIE_NAME}=1; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
