"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

export type SignInErrorCode = "NOT_CONFIGURED" | "INVALID_INPUT" | "INVALID_CREDENTIALS";

export type SignInResult = { ok: true } | { ok: false; code: SignInErrorCode };

/**
 * /login (Phase 2 of removing OTP): one field takes either a real email
 * or a username. A username is never itself a valid Supabase Auth
 * identifier (Supabase Auth is email-native), so it resolves to the
 * synthetic email behind it first (lib/auth/signUp.ts,
 * lib/auth/completeAccount.ts mint that pairing). The resolution needs
 * the admin client because the caller isn't authenticated yet — there is
 * no auth.uid() an RLS-respecting query could scope to.
 *
 * Signs in on the COOKIE-writing server client (lib/supabase/server.ts),
 * not the browser client — this establishes the session entirely
 * server-side, in one round trip.
 */
export async function signInAction(identifier: string, password: string): Promise<SignInResult> {
  if (!isSupabaseConfigured()) return { ok: false, code: "NOT_CONFIGURED" };

  const trimmed = identifier.trim().toLowerCase();
  if (!trimmed || !password) return { ok: false, code: "INVALID_INPUT" };

  let email = trimmed;

  if (!email.includes("@")) {
    const admin = createAdminClient();
    if (!admin) return { ok: false, code: "NOT_CONFIGURED" };

    const { data } = await admin.from("users").select("email").eq("username", email).maybeSingle();
    if (!data?.email) return { ok: false, code: "INVALID_CREDENTIALS" };
    email = data.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, code: "INVALID_CREDENTIALS" };

  return { ok: true };
}
