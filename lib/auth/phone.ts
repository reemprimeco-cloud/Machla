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

/**
 * Kuwait, the market this app serves. The sign-in screen shows this as a
 * fixed, non-editable chip and the user types ONLY the local digits —
 * asking this audience to type "+965" produced real failed sign-ins
 * ("+965 65068000" with the space, "0096565068000", missing "+"). The
 * app, not the user, is responsible for E.164.
 */
export const KUWAIT_DIAL_CODE = "+965";

/** Kuwaiti subscriber numbers are exactly 8 digits. */
export const LOCAL_NUMBER_LENGTH = 8;

/** "65068000" -> "+96565068000". The caller guarantees digits-only input
 * (the sign-in input strips as the user types, like the OTP box). */
export function toE164FromLocal(localDigits: string): string {
  return `${KUWAIT_DIAL_CODE}${localDigits}`;
}

/**
 * How the sign-in code reaches the user.
 *
 * 'whatsapp', by an explicit product decision (2026-08-12, owner-approved;
 * 06-auth-otp-flow.md §1): the Twilio account is WhatsApp-approved with a
 * working sender, WhatsApp is effectively universal among this app's
 * users in Kuwait, and branded SMS to Kuwait requires carrier
 * pre-registration (NOCs to Zain/Ooredoo) measured in weeks. That SMS
 * registration is running in parallel — when it lands, flipping this one
 * constant back to 'sms' (or making it per-user) is the whole change.
 *
 * The verify step is channel-agnostic: verifyOtp keeps type 'sms' either
 * way; only delivery differs.
 */
export const OTP_CHANNEL: "sms" | "whatsapp" = "whatsapp";
