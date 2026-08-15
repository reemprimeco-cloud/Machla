import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

/**
 * The one client in this codebase authorized by something other than
 * the caller's own session: the service role key, which bypasses RLS
 * entirely. Every other client (`lib/supabase/client.ts`,
 * `lib/supabase/server.ts`) uses only the public anon key — RLS is what
 * authorizes them, not their own privilege (docs/architecture/10-security-model.md).
 *
 * This one exists for exactly one job that genuinely cannot be done any
 * other way: deleting a user's own `auth.users` row
 * (`lib/auth/deleteAccount.ts`). There is no self-service "delete my own
 * auth account" method — only `auth.admin.deleteUser`, which only the
 * service role may call. Nothing else in this codebase should reach for
 * this client; if a feature seems to need it, that is a sign to look for
 * the RLS policy or SECURITY DEFINER RPC that should be doing the job
 * instead.
 *
 * `SUPABASE_SERVICE_ROLE_KEY` lives in the server-side environment only:
 * never `NEXT_PUBLIC_*`, never in the repository, never pasted into a
 * chat window. Anyone holding it can read or write any row in the
 * database, in any household, bypassing every RLS policy this project
 * has — it is as sensitive as direct database superuser access.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
