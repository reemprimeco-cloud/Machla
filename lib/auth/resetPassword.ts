"use server";

import { EMAIL_PATTERN, MIN_PASSWORD_LENGTH } from "@/lib/auth/identity";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

export type ResetPasswordErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_EMAIL"
  | "INVALID_PASSWORD"
  | "INVALID_LINK"
  | "UNKNOWN";

export type ResetPasswordResult = { ok: true } | { ok: false; code: ResetPasswordErrorCode };

/**
 * "Forgot password" (Phase 2 of removing OTP) — has no equivalent under
 * phone+OTP, since there was never a password to forget. Three steps,
 * each its own Server Action because they happen on three different page
 * loads (request the email -> click the link -> set a new password):
 *
 *   1. requestPasswordResetAction: sends the email. Always reports ok on
 *      a well-formed address whether or not an account actually has it —
 *      Supabase itself doesn't reveal that either, and neither should
 *      this app (no account enumeration via "no such email").
 *   2. exchangeRecoveryCodeAction: the emailed link's `?code=` gets
 *      exchanged for a session scoped to this recovery only — Supabase
 *      Auth's own scoping, not something this app enforces.
 *   3. setNewPasswordAction: sets the new password on that recovery
 *      session. Only a synthetic worker email has no real path here —
 *      see lib/auth/identity.ts — which is why /login only offers
 *      "forgot password" from the email side, never the username one.
 */
export async function requestPasswordResetAction(
  rawEmail: string,
  redirectTo: string,
): Promise<ResetPasswordResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { ok: false, code: "INVALID_EMAIL" };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  return { ok: true };
}

export async function exchangeRecoveryCodeAction(code: string): Promise<ResetPasswordResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return { ok: false, code: "INVALID_LINK" };

  return { ok: true };
}

export async function setNewPasswordAction(password: string): Promise<ResetPasswordResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: "INVALID_PASSWORD" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, code: "UNKNOWN" };

  return { ok: true };
}
