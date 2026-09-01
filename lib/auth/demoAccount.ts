import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The App Store Connect demo account, bypassing Twilio/WhatsApp/SMS
 * entirely — see docs/architecture/06-auth-otp-flow.md for the trail of
 * failed attempts that led here (channel mismatches, Test OTP silently
 * not firing, a real WhatsApp code landing instead of the documented
 * fixed one). Rather than keep debugging a third party's OTP-bypass
 * feature we don't control, this account's sign-in never calls
 * `signInWithOtp`/`verifyOtp` with `type: "sms"` at all: `demoSignIn()`
 * mints a real Supabase session directly via the admin API's
 * `generateLink`, which this app already holds a client for
 * (`lib/supabase/admin.ts`, used by account deletion).
 *
 * The phone number itself is the owner's own real number (2026-09-01,
 * owner-approved, after two rotations through numbers that turned out
 * to be either a real stranger's or rejected outright by the phone
 * provider) — read from a server-only env var, never `NEXT_PUBLIC_*`,
 * so it never reaches the browser bundle and never sits as a literal in
 * this public repository.
 *
 * The email is an internal technical identifier only — nobody reads
 * this inbox, it exists purely so `generateLink({ type: "magiclink" })`
 * has an existing-user email to resolve to instead of creating a new,
 * disconnected account. Safe to be a plain constant: it identifies no
 * one and sends nothing.
 */
const DEMO_ACCOUNT_EMAIL = "demo-account@machla.internal";
const DEMO_ACCOUNT_CODE = "123456";

function demoAccountPhone(): string | null {
  return process.env.DEMO_ACCOUNT_PHONE || null;
}

export function isDemoAccountPhone(e164Phone: string): boolean {
  const demoPhone = demoAccountPhone();
  return demoPhone !== null && e164Phone === demoPhone;
}

export type DemoSignInResult =
  | { ok: true; tokenHash: string }
  | { ok: false; reason: "not_demo_account" | "wrong_code" | "not_configured" };

/** Verifies the phone+code pair server-side and, on a match, returns a
 * magic-link token hash the client can hand to `supabase.auth.verifyOtp`
 * to establish a real session — no message ever sent anywhere. */
export async function demoSignIn(
  e164Phone: string,
  code: string,
): Promise<DemoSignInResult> {
  if (!isDemoAccountPhone(e164Phone)) return { ok: false, reason: "not_demo_account" };
  if (code !== DEMO_ACCOUNT_CODE) return { ok: false, reason: "wrong_code" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, reason: "not_configured" };

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEMO_ACCOUNT_EMAIL,
  });
  if (error || !data?.properties?.hashed_token) {
    return { ok: false, reason: "not_configured" };
  }

  return { ok: true, tokenHash: data.properties.hashed_token };
}
