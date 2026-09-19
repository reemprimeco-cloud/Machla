"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/**
 * Phase 1 of removing OTP (20260919120000_email_password_identity.sql):
 * lets an account already signed in via phone+OTP add an email/username +
 * password, without needing OTP again — the caller's existing session is
 * the authorization, so this only ever touches `auth.uid()`'s own row.
 *
 * The admin client is required here for the one thing only it can do:
 * `auth.admin.updateUserById` is the sole way to set a password and mark
 * an email confirmed without Supabase Auth sending (and waiting on) a
 * real confirmation link — the same reason lib/auth/deleteAccount.ts
 * reaches for it. Everything else in this file runs on the caller's own
 * session and RLS, per lib/supabase/admin.ts's rule.
 */

export type CompleteAccountErrorCode =
  | "AUTH_REQUIRED"
  | "NOT_CONFIGURED"
  | "INVALID_EMAIL"
  | "INVALID_USERNAME"
  | "INVALID_PASSWORD"
  | "EMAIL_TAKEN"
  | "USERNAME_TAKEN"
  | "UNKNOWN";

export type CompleteAccountResult =
  | { ok: true }
  | { ok: false; code: CompleteAccountErrorCode };

/** Nobody reads this inbox — see lib/auth/demoAccount.ts for the
 * established pattern of a *.machla.internal address as a pure
 * identifier, never a real mailbox. */
const SYNTHETIC_EMAIL_DOMAIN = "workers.machla.internal";

// Lowercase-only (callers normalize first), starts alphanumeric, safe as
// both a username and an email local-part.
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,23}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function mapAuthError(message: string | undefined): CompleteAccountErrorCode {
  const text = (message ?? "").toLowerCase();
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "EMAIL_TAKEN";
  }
  if (text.includes("password")) return "INVALID_PASSWORD";
  return "UNKNOWN";
}

async function applyIdentity(
  email: string,
  password: string,
  extra: { username: string | null; isSynthetic: boolean },
): Promise<CompleteAccountResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: "INVALID_PASSWORD" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, code: "NOT_CONFIGURED" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, code: "AUTH_REQUIRED" };

  const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
    email,
    password,
    email_confirm: true,
  });
  if (authError) return { ok: false, code: mapAuthError(authError.message) };

  const { error: dbError } = await supabase
    .from("users")
    .update({
      email,
      username: extra.username,
      is_synthetic_email: extra.isSynthetic,
      account_completed_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  // The auth.users side already succeeded — the account fully works with
  // its new email/password even if this mirror write failed. Surfacing
  // UNKNOWN here just tells the caller to expect a stale profile display,
  // not that anything needs retrying.
  if (dbError) return { ok: false, code: "UNKNOWN" };

  return { ok: true };
}

/** Owners/members: a real email they already have. */
export async function completeAccountWithEmailAction(
  rawEmail: string,
  password: string,
): Promise<CompleteAccountResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { ok: false, code: "INVALID_EMAIL" };

  return applyIdentity(email, password, { username: null, isSynthetic: false });
}

/** Workers: a username only, no real email required — see the synthetic
 * address note above. */
export async function completeAccountWithUsernameAction(
  rawUsername: string,
  password: string,
): Promise<CompleteAccountResult> {
  const username = rawUsername.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) return { ok: false, code: "INVALID_USERNAME" };

  const result = await applyIdentity(`${username}@${SYNTHETIC_EMAIL_DOMAIN}`, password, {
    username,
    isSynthetic: true,
  });
  if (!result.ok && result.code === "EMAIL_TAKEN") return { ok: false, code: "USERNAME_TAKEN" };
  return result;
}
