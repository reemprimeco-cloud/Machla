"use server";

import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

/**
 * Subscribe/unsubscribe Server Actions.
 *
 * Unlike every other mutation in this app (lib/list/actions.ts,
 * lib/household/actions.ts, ...), these do NOT go through a SECURITY
 * DEFINER RPC — there is nothing here an RPC would need to check beyond
 * "is this the caller's own row", which RLS on push_subscriptions
 * already enforces directly (20260812140000_push_notifications.sql),
 * the same way a user is trusted to edit their own `users` row without
 * one (docs/architecture/10-security-model.md §1).
 */

export async function savePushSubscriptionAction(subscription: {
  endpoint: string;
  p256dh: string;
  authKey: string;
}): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  // Upsert on endpoint, not (user_id, endpoint): the endpoint IS the
  // browser subscription, so a re-subscribe under a different signed-in
  // account (shared device) should move the row, not duplicate it.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth_key: subscription.authKey,
    },
    { onConflict: "endpoint" },
  );

  return { ok: !error };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<{ ok: boolean }> {
  if (!isSupabaseConfigured()) return { ok: false };

  const supabase = await createClient();
  // RLS scopes this to the caller's own row regardless, but matching on
  // endpoint too keeps this action doing exactly what its one caller
  // (unsubscribing THIS browser) means, rather than "delete whichever of
  // my subscriptions I happen to be authorized to delete".
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);

  return { ok: !error };
}
