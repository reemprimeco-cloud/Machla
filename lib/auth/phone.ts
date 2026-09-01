/**
 * Converts digits typed in a non-Latin script (Arabic-Indic, Persian/Urdu,
 * Devanagari, Telugu, fullwidth) to plain ASCII 0-9, in place, leaving
 * everything else untouched.
 *
 * Necessary because JS's `\d`/`\D` regex classes only ever match ASCII
 * digits — someone typing on an Arabic, Hindi, Telugu, etc. keyboard's
 * native numerals into the phone or OTP box would otherwise have every
 * digit silently stripped by the `.replace(/\D/g, "")` those inputs use,
 * rather than converted, since `\D` treats a native digit as "not a
 * digit" exactly like a letter.
 *
 * Each block below is Unicode's contiguous 0-9 run for that script, so a
 * character's value is just its offset from the block's zero.
 */
const DIGIT_BLOCK_STARTS = [
  0x0660, // Arabic-Indic ٠-٩ (Arabic)
  0x06f0, // Extended Arabic-Indic ۰-۹ (Persian/Urdu)
  0x0966, // Devanagari ०-९ (Hindi/Nepali)
  0x0c66, // Telugu ౦-౯
  0x0de6, // Sinhala Lith ෦-෯
  0xff10, // Fullwidth 0-9 (some IMEs)
];

export function normalizeDigits(input: string): string {
  return Array.from(input)
    .map((char) => {
      const code = char.codePointAt(0)!;
      if (code >= 0x30 && code <= 0x39) return char; // already ASCII 0-9
      for (const base of DIGIT_BLOCK_STARTS) {
        if (code >= base && code <= base + 9) return String(code - base);
      }
      return char;
    })
    .join("");
}

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

/** The App Store Connect demo account (ios/app-store-listing.md). Supabase's
 * Test OTP feature (Authentication → Sign In / Up → Phone → Test OTP) is
 * documented as intercepting SMS delivery specifically — it skips the real
 * provider and accepts only the mapped fixed code. Routing this one number
 * through `channel: 'whatsapp'` like every other sign-in would send it a
 * real WhatsApp message with a random code instead of tripping that
 * bypass, which is almost certainly why Apple's reviewer couldn't sign in
 * with the documented 123456 code (Guideline 2.1 rejection, 2026-08-31). */
export const DEMO_ACCOUNT_PHONE = "+96590909090";

export function otpChannelFor(e164Phone: string): "sms" | "whatsapp" {
  return e164Phone === DEMO_ACCOUNT_PHONE ? "sms" : OTP_CHANNEL;
}
