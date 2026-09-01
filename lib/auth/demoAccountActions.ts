"use server";

import { demoSignIn, isDemoAccountPhone } from "./demoAccount";
import type { DemoSignInResult } from "./demoAccount";

/** Called from /login before deciding whether to send a real OTP at all —
 * see demoAccount.ts for why the demo account skips that path entirely. */
export async function checkDemoAccountAction(e164Phone: string): Promise<boolean> {
  return isDemoAccountPhone(e164Phone);
}

/** Called from /login/verify in place of `supabase.auth.verifyOtp` when
 * the phone is the demo account. */
export async function demoSignInAction(
  e164Phone: string,
  code: string,
): Promise<DemoSignInResult> {
  return demoSignIn(e164Phone, code);
}
