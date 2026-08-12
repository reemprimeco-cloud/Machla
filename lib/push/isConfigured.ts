/**
 * Whether VAPID keys are present, mirroring
 * lib/supabase/isConfigured.ts's isSupabaseConfigured() — every
 * push-calling code path degrades to a no-op rather than throwing when
 * these are unset, the same way the rest of the app degrades when
 * Supabase itself isn't configured. Safe to import from client
 * components: only checks the public key.
 */
export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
}
