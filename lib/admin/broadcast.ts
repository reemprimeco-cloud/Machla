"use server";

import { requireAdminAccess } from "@/lib/admin/guard";
import { createApnsSender } from "@/lib/push/apns";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminBroadcastResult =
  | { ok: true; sent: number; total: number }
  | { ok: false; code: "NOT_CONFIGURED" | "NO_DEVICES" | "INVALID_INPUT" };

const APNS_PREFIX = "apns://";

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
    const { data: devices, error } = await admin
      .from("push_subscriptions")
      .select("endpoint")
      .eq("platform", "ios");
    if (error || !devices || devices.length === 0) return { ok: false, code: "NO_DEVICES" };

    const staleEndpoints: string[] = [];
    let sent = 0;

    await Promise.all(
      devices.map(async (device) => {
        const result = await apns.send(device.endpoint.slice(APNS_PREFIX.length), {
          title: trimmedTitle,
          body: trimmedBody,
          threadId: "admin-broadcast",
          url: "/",
        });
        if (result.ok) sent++;
        else if (result.gone) staleEndpoints.push(device.endpoint);
      }),
    );

    if (staleEndpoints.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return { ok: true, sent, total: devices.length };
  } finally {
    apns.close();
  }
}
