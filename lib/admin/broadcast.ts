"use server";

import { requireAdminAccess } from "@/lib/admin/guard";
import { createApnsSender } from "@/lib/push/apns";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminBroadcastAudience = "all" | "trial_lapsed";

export type AdminBroadcastResult =
  | { ok: true; sent: number; total: number }
  | { ok: false; code: "NOT_CONFIGURED" | "NO_DEVICES" | "INVALID_INPUT" };

const APNS_PREFIX = "apns://";

type AdminSupabase = NonNullable<ReturnType<typeof createAdminClient>>;

/** Which iOS device tokens a given audience resolves to. "all" is every
 * registered device; "trial_lapsed" is the OWNER of each household whose
 * free trial ended without ever subscribing — the same set
 * admin_get_stats() counts as subscriptions_lapsed (owners are who
 * subscription_status/trial_ends_at describes, and who Settings →
 * Subscription lets act on it; members/workers have no billing role to
 * nudge here). */
async function resolveTargetEndpoints(
  admin: AdminSupabase,
  audience: AdminBroadcastAudience,
): Promise<string[]> {
  if (audience === "all") {
    const { data } = await admin.from("push_subscriptions").select("endpoint").eq("platform", "ios");
    return (data ?? []).map((row) => row.endpoint);
  }

  const { data: lapsedHouseholds } = await admin
    .from("households")
    .select("owner_user_id")
    .eq("subscription_status", "none")
    .lt("trial_ends_at", new Date().toISOString());
  const ownerIds = [...new Set((lapsedHouseholds ?? []).map((row) => row.owner_user_id))];
  if (ownerIds.length === 0) return [];

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint")
    .eq("platform", "ios")
    .in("user_id", ownerIds);
  return (subs ?? []).map((row) => row.endpoint);
}

/**
 * The admin page's "communication" section: a manual push to every
 * iPhone (APNs) device on file — for an announcement the ordinary
 * notification pipeline (lib/push/send.ts) has no type for, since this
 * is the operator addressing everyone directly rather than a reaction to
 * a list event.
 *
 * Reads every push_subscriptions row in the project via the admin
 * client, by design: there is no signed-in recipient whose auth.uid() an
 * RLS-respecting query could scope to, since the whole point is reaching
 * people other than the caller (lib/supabase/admin.ts's rule — this is
 * the one kind of read that genuinely cannot go through RLS).
 */
export async function sendAdminBroadcastAction(
  title: string,
  body: string,
  audience: AdminBroadcastAudience = "all",
): Promise<AdminBroadcastResult> {
  await requireAdminAccess();

  const trimmedTitle = title.trim();
  const trimmedBody = body.trim();
  if (!trimmedTitle || !trimmedBody) return { ok: false, code: "INVALID_INPUT" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, code: "NOT_CONFIGURED" };

  const apns = createApnsSender();
  if (!apns) return { ok: false, code: "NOT_CONFIGURED" };

  try {
    const endpoints = await resolveTargetEndpoints(admin, audience);
    if (endpoints.length === 0) return { ok: false, code: "NO_DEVICES" };

    const staleEndpoints: string[] = [];
    let sent = 0;

    await Promise.all(
      endpoints.map(async (endpoint) => {
        const result = await apns.send(endpoint.slice(APNS_PREFIX.length), {
          title: trimmedTitle,
          body: trimmedBody,
          threadId: "admin-broadcast",
          url: "/",
        });
        if (result.ok) sent++;
        else if (result.gone) staleEndpoints.push(endpoint);
      }),
    );

    if (staleEndpoints.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return { ok: true, sent, total: endpoints.length };
  } finally {
    apns.close();
  }
}
