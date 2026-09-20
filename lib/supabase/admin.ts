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
 * Two jobs reach for it, both because they genuinely cannot be done any
 * other way:
 *
 *   - Deleting a user's own `auth.users` row (`lib/auth/deleteAccount.ts`).
 *     There is no self-service "delete my own auth account" method — only
 *     `auth.admin.deleteUser`, which only the service role may call.
 *   - The list-reminder sweep (`lib/push/send.ts` sendListSentReminders,
 *     `app/api/cron/list-reminders/route.ts`). It runs from a schedule,
 *     not a signed-in caller, so there is no `auth.uid()` an RLS policy or
 *     a SECURITY DEFINER RPC could scope it to — unlike every other push
 *     path, which reads back the CALLER's own action.
 *   - Setting a password and confirming an email on the CALLER's own
 *     account (`lib/auth/completeAccount.ts`). `auth.admin.updateUserById`
 *     is the only way to do either without Supabase Auth mailing out (and
 *     waiting on) a real confirmation link — the account is still the
 *     caller's own, verified via their session before this is ever
 *     reached, same discipline as account deletion above.
 *   - The admin page's manual push broadcast (`lib/admin/broadcast.ts`).
 *     Reading every push_subscriptions row in the project genuinely has
 *     no `auth.uid()` to scope an RLS-respecting query to — the whole
 *     point is reaching people other than the caller — gated by
 *     `requireAdminAccess()` before this is ever reached, same as every
 *     other admin-page query.
 *
 * Nothing else in this codebase should reach for this client; if a
 * feature seems to need it, that is a sign to look for the RLS policy or
 * SECURITY DEFINER RPC that should be doing the job instead.
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
