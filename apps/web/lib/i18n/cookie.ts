/**
 * Device-local locale persistence (Phase 2).
 *
 * A plain (non-httpOnly) cookie, not localStorage, so both the server
 * (root layout, via next/headers) and the client can read it — that's
 * what lets the very first server-rendered response already have the
 * correct <html lang dir>, avoiding an RTL/LTR flash and any hydration
 * mismatch. Not sensitive data, so a readable cookie is fine.
 *
 * Once Phase 3 auth exists, this cookie remains the pre-login and
 * fallback source; a signed-in user's `users.preferred_language` (see
 * docs/architecture/03-database-schema.md) becomes the authoritative
 * value and can be written back into this same cookie on login/change so
 * the two stay in sync without introducing a second client-side store.
 */

export const LOCALE_COOKIE_NAME = "homelist_locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function readLocaleCookieClient(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE_NAME}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function writeLocaleCookieClient(code: string): void {
  if (typeof document === "undefined") return;

  document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(code)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}
