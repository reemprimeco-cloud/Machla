import "server-only";

import { cookies } from "next/headers";

/**
 * Which household the owner/member experience currently shows.
 *
 * A user can belong to several households (My Home, My Office, ...) — this
 * cookie remembers which one they last chose, the same pattern the locale
 * cookie already uses (`lib/i18n/cookie.ts`) for a device-level preference
 * that should survive a reload without a database round trip.
 *
 * Only ever trusted after being re-validated against the caller's actual
 * active memberships (`lib/household/guard.ts`) — a stale or tampered
 * value just falls back to the first membership, the same way an unset
 * cookie does. It is never itself an authorization check.
 */
const COOKIE_NAME = "hl_household";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export async function getSelectedHouseholdId(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value ?? null;
}

/** Server Actions and Route Handlers only — Next.js forbids writing
 * cookies from a plain Server Component render. */
export async function setSelectedHouseholdId(householdId: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, householdId, {
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
  });
}
