"use server";

import {
  EMAIL_PATTERN,
  MIN_PASSWORD_LENGTH,
  USERNAME_PATTERN,
  syntheticEmailFor,
} from "@/lib/auth/identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

export type SignUpErrorCode =
  | "NOT_CONFIGURED"
  | "INVALID_EMAIL"
  | "INVALID_USERNAME"
  | "INVALID_PASSWORD"
  | "EMAIL_TAKEN"
  | "USERNAME_TAKEN"
  | "UNKNOWN";

export type SignUpResult = { ok: true } | { ok: false; code: SignUpErrorCode };

function mapCreateError(message: string | undefined): SignUpErrorCode {
  const text = (message ?? "").toLowerCase();
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "EMAIL_TAKEN";
  }
  if (text.includes("password")) return "INVALID_PASSWORD";
  return "UNKNOWN";
}

/**
 * Brand-new accounts (Phase 2 of removing OTP) — no phone, no OTP,
 * anywhere in the world. Two admin-only steps:
 *
 *   1. `admin.createUser` with `email_confirm: true` — the only way to
 *      create an account AND mark its email confirmed without Supabase
 *      Auth mailing out a real confirmation link (same reasoning as
 *      lib/auth/completeAccount.ts).
 *   2. `admin.generateLink({type: "magiclink"})` -> `verifyOtp` on the
 *      COOKIE-writing server client, minting a real session in the same
 *      request — the pattern lib/auth/demoAccount.ts established,
 *      generalized: there is no admin call that logs the browser in as
 *      the user just created, so a magic-link token is how this codebase
 *      always bridges that gap.
 *
 * public.users.email/username gets filled by the handle_new_user()
 * trigger (20260920110000_phone_optional_identity.sql) the instant
 * admin.createUser's insert into auth.users fires it — nothing here
 * writes to public.users directly.
 */
async function createAndSignIn(
  email: string,
  password: string,
  extra: { username: string | null; isSynthetic: boolean },
): Promise<SignUpResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: "INVALID_PASSWORD" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, code: "NOT_CONFIGURED" };

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created?.user) {
    return { ok: false, code: mapCreateError(createError?.message) };
  }

  // handle_new_user() (20260920110000_phone_optional_identity.sql) only
  // ever sees phone/email — it has no way to know this email is a
  // synthetic placeholder rather than a real one, so that has to be
  // recorded here, in the one place that actually knows.
  if (extra.username) {
    await admin
      .from("users")
      .update({ username: extra.username, is_synthetic_email: extra.isSynthetic })
      .eq("id", created.user.id);
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !link?.properties?.hashed_token) return { ok: false, code: "UNKNOWN" };

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (verifyError) return { ok: false, code: "UNKNOWN" };

  return { ok: true };
}

/** Owners/members: a real email, open to anyone, anywhere. */
export async function signUpWithEmailAction(
  rawEmail: string,
  password: string,
): Promise<SignUpResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { ok: false, code: "INVALID_EMAIL" };

  return createAndSignIn(email, password, { username: null, isSynthetic: false });
}

/** Workers: a username only — see lib/auth/completeAccount.ts for why a
 * synthetic address exists at all. */
export async function signUpWithUsernameAction(
  rawUsername: string,
  password: string,
): Promise<SignUpResult> {
  const username = rawUsername.trim().toLowerCase();
  if (!USERNAME_PATTERN.test(username)) return { ok: false, code: "INVALID_USERNAME" };

  const result = await createAndSignIn(syntheticEmailFor(username), password, {
    username,
    isSynthetic: true,
  });
  if (!result.ok && result.code === "EMAIL_TAKEN") return { ok: false, code: "USERNAME_TAKEN" };
  return result;
}
