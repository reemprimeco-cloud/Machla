import "server-only";

import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";
import { fetchWithTimeout } from "./fetchWithTimeout";

/**
 * A plain, session-less Supabase client — no cookies(), no auth context —
 * for reference data that is genuinely world-readable (`categories` and
 * `products` both have an RLS policy of `using (true)`, per
 * lib/catalog/queries.ts's own comment) and carries no per-user
 * filtering.
 *
 * Exists only so lib/catalog/queries.ts's cached reads can run inside
 * unstable_cache(): Next.js forbids calling cookies()/headers() — what
 * lib/supabase/server.ts's createClient() does — from inside a cached
 * function's callback, since a cached result must not vary by caller.
 *
 * Lazily constructed, not a module-level client, so importing this file
 * never throws when Supabase isn't configured (docs/architecture/
 * 14-technical-risks-decisions.md item 10) — callers must still check
 * isSupabaseConfigured() first, same as every other Supabase call site.
 */
let client: SupabaseClient<Database> | null = null;

export function getPublicCatalogClient(): SupabaseClient<Database> {
  if (!client) {
    client = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: fetchWithTimeout() } },
    );
  }
  return client;
}
