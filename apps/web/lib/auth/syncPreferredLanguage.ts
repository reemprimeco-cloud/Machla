"use client";

import type { LocaleCode } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/**
 * Best-effort write-through of a locale change into `users.preferred_language`
 * (docs/architecture/15-localization-architecture.md §2: the cookie stays
 * the single client-side source of truth pre- and post-auth; this just
 * keeps the DB copy in sync once someone is signed in, so their
 * preference follows them to a new device on next login).
 *
 * Uses `getSession()` (local, no network round trip) only to decide
 * whether it's worth attempting the write at all — the actual
 * authorization for the write itself is the `users_update_own` RLS
 * policy (Phase 1 migration), not this check.
 */
export async function syncPreferredLanguageIfSignedIn(locale: LocaleCode): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  await supabase
    .from("users")
    .update({ preferred_language: locale })
    .eq("id", session.user.id);
}
