import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./database.types";

/**
 * Supabase client for use in Client Components. Uses only the public
 * anon key — never the service role key (docs/architecture/10-security-model.md §6).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
