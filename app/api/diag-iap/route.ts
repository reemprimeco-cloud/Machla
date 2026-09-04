// TEMPORARY — one-off check that APPLE_IAP_KEY_ID / APPLE_IAP_ISSUER_ID /
// APPLE_IAP_PRIVATE_KEY / APNS_BUNDLE_ID are all present on Vercel.
// Reveals presence only, never values — same non-secret boolean pattern
// as isSupabaseConfigured()/isPushConfigured(). Delete after checking.

import { isAppleIapConfigured } from "@/lib/subscription/apple";

export async function GET() {
  return Response.json({ configured: isAppleIapConfigured() });
}
