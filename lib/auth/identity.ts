/**
 * Shared by every place an account's email/username/password gets
 * validated or a worker's synthetic address gets minted —
 * lib/auth/completeAccount.ts (an existing session adding credentials)
 * and lib/auth/signUp.ts (a brand-new account, Phase 2 of removing OTP).
 * One definition so the two paths can't quietly drift apart.
 */

/** Nobody reads this inbox — see lib/auth/demoAccount.ts for the
 * originating pattern of a *.machla.internal address as a pure
 * identifier, never a real mailbox. */
export const SYNTHETIC_EMAIL_DOMAIN = "workers.machla.internal";

// Lowercase-only (callers normalize first), starts alphanumeric, safe as
// both a username and an email local-part.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,23}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;

export function syntheticEmailFor(username: string): string {
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}
