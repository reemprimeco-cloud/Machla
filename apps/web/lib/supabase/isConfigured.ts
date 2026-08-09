/**
 * Whether a live Supabase project's credentials are present. Per the
 * project's explicit instruction, no Supabase project is provisioned yet
 * (docs/architecture/14-technical-risks-decisions.md item 10) — every
 * piece of Supabase-calling code must degrade gracefully (treat the
 * visitor as signed-out) rather than crash the page when these are
 * unset, so the app keeps satisfying the Phase 1 "runs locally" baseline
 * regardless of auth being wired up.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) && Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
