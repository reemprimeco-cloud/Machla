/**
 * Minimal E.164 phone validation/normalization, shared by /login and
 * /login/verify. Supabase Auth expects E.164 (+<country code><number>,
 * digits only after the leading +).
 */
export function normalizePhone(raw: string): string {
  const trimmed = raw.trim().replace(/[\s\-()]/g, "");
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

/** Loose E.164 check: + followed by 8-15 digits. Not a full per-country
 * validator — Supabase Auth/the SMS provider reject anything it can't
 * actually deliver to, this is just fast client-side feedback. */
export function isValidPhone(raw: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(raw));
}

/** Default country code shown in the /login input — Kuwait, the
 * primary market (master plan, docs/architecture/06-auth-otp-flow.md). */
export const DEFAULT_PHONE_PREFIX = "+965 ";
