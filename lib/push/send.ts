import "server-only";

import webpush from "web-push";

import { branding } from "@/lib/branding";
import { getMessage, getMessages } from "@/lib/i18n/messages";
import type { MessageKey } from "@/lib/i18n/messages";
import { createAdminClient } from "@/lib/supabase/admin";
import type { NotificationType } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { createApnsSender } from "./apns";
import { isPushConfigured } from "./isConfigured";

const BODY_KEYS: Record<NotificationType, MessageKey> = {
  list_sent: "notif.listSent",
  list_viewed: "notif.listViewed",
  list_completed: "notif.listCompleted",
};

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

/** APNs rows store the device token in `endpoint`, behind this scheme,
 * so that one unique column keeps addressing one installation whichever
 * transport it belongs to (20260814100000_apns_push.sql). */
const APNS_PREFIX = "apns://";

/**
 * Reads back this caller's own fallout from the status change they just
 * made (get_pending_pushes — scoped to actor_user_id = auth.uid(), see
 * 20260812140000_push_notifications.sql), sends one push per subscribed
 * recipient translated into THEIR OWN preferred_language, and marks
 * whichever sends succeeded.
 *
 * Two transports, one fan-out: a browser (or an installed PWA) is
 * reached over Web Push, an App Store build over APNs. Which one a
 * recipient needs is a property of the row, not of this function, so
 * everything either transport does NOT change — who gets told, in what
 * language, opening which screen — is decided once, above the branch.
 *
 * Best-effort by design, same as markListViewedAction: a push that
 * fails to send must never fail the caller's action, and every call
 * site awaits this only after its own RPC already succeeded. Errors are
 * swallowed here, not re-thrown, for the same reason.
 */
export async function sendPendingPushes(listId: string, type: NotificationType): Promise<void> {
  // VAPID missing only disables the web half; APNs has its own
  // credentials and its own configured-check, so an iPhone-only
  // deployment still works and vice versa.
  const web = isPushConfigured() && ensureVapid();
  const apns = createApnsSender();
  if (!web && !apns) {
    // Every notification row ever created has pushed_at = null — this is
    // the prime suspect: if neither transport's env vars are set on
    // Vercel, every single call returns here, silently, always. Logged
    // (not thrown) to keep the best-effort contract this function
    // documents above — a push failure must never fail the caller.
    console.error(
      "[push] not configured: web =",
      isPushConfigured(),
      "vapid =",
      web,
      "apns =",
      Boolean(apns),
    );
    return;
  }

  try {
    const supabase = await createClient();
    const { data: pending, error } = await supabase.rpc("get_pending_pushes", {
      p_list_id: listId,
      p_type: type,
    });
    if (error) {
      console.error("[push] get_pending_pushes error:", error.message);
      return;
    }
    if (!pending || pending.length === 0) {
      console.error("[push] no pending rows for", type, listId);
      return;
    }
    console.error(
      "[push] sending",
      pending.length,
      "notification(s) for",
      type,
      "web =",
      web,
      "apns =",
      Boolean(apns),
    );

    const sentIds: string[] = [];
    const staleEndpoints: string[] = [];

    await Promise.all(
      pending.map(async (row) => {
        const messages = getMessages(row.preferred_language ?? "en");
        const body = getMessage(messages, BODY_KEYS[type], {
          name: row.actor_name ?? getMessage(messages, "hlists.someone"),
        });
        const title = branding.name;
        const threadId = `list-${listId}-${type}`;
        const url = row.is_household_side ? `/home/lists/${listId}` : "/worker/lists";

        if (row.push_platform === "ios") {
          if (!apns) {
            console.error("[push] ios row but apns not configured:", row.notification_id);
            return;
          }
          const result = await apns.send(row.endpoint.slice(APNS_PREFIX.length), {
            title,
            body,
            threadId,
            url,
          });
          if (result.ok) {
            sentIds.push(row.notification_id);
          } else {
            console.error("[push] apns send failed:", result.reason, "gone =", result.gone);
            // Apple's permanent failures mean the same thing Web Push's
            // 404/410 does — the app was deleted, or this token was
            // minted against the other APNs environment. Either way it
            // will never be deliverable again.
            if (result.gone) staleEndpoints.push(row.endpoint);
          }
          return;
        }

        if (!web || !row.p256dh || !row.auth_key) {
          console.error(
            "[push] web row but not sendable: web =",
            web,
            "hasKeys =",
            Boolean(row.p256dh && row.auth_key),
          );
          return;
        }

        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
            JSON.stringify({ title, body, tag: threadId, url }),
          );
          sentIds.push(row.notification_id);
        } catch (err) {
          // 404/410 means the browser dropped this subscription (site
          // data cleared, app uninstalled, ...) — the push service is
          // telling us it will never work again, so stop retrying by
          // removing the row rather than leaving a dead subscription to
          // fail silently on every future notification.
          const statusCode = (err as { statusCode?: number }).statusCode;
          console.error("[push] web push failed:", statusCode, (err as Error).message);
          if (statusCode === 404 || statusCode === 410) {
            staleEndpoints.push(row.endpoint);
          }
        }
      }),
    );

    if (sentIds.length > 0) {
      await supabase.rpc("mark_pushes_sent", { p_notification_ids: sentIds });
    }
    if (staleEndpoints.length > 0) {
      await supabase.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }
  } catch (err) {
    // Never let a push failure surface to the caller of the action that
    // triggered it — see the function comment above. Logged so a thrown
    // (not merely returned) error is still visible somewhere.
    console.error("[push] sendPendingPushes threw:", err);
  } finally {
    // The HTTP/2 session outlives the sends unless it is closed, and a
    // serverless invocation that never becomes idle is one that gets
    // killed mid-flight rather than frozen for reuse.
    apns?.close();
  }
}

export interface ReminderSweepResult {
  candidates: number;
  sent: number;
}

/**
 * One-time follow-up push for a `list_sent` notification nobody has
 * opened yet — see 20260915000000_list_sent_reminder_push.sql for why
 * this reuses that type instead of minting a new one, and why it needs
 * the service-role client rather than get_pending_pushes: unlike
 * sendPendingPushes, there is no signed-in caller here to scope an RPC
 * to — this runs from app/api/cron/list-reminders/route.ts, on a
 * schedule, across every household at once.
 *
 * `reminder_sent_at` is stamped on every candidate row this sweep looks
 * at, whether or not a push actually went out — a recipient who never
 * enabled push, or whose only subscription is stale, must not be
 * rescanned (and logged as a candidate) on every future run. That is a
 * deliberate difference from `pushed_at`, which is only set on an
 * actually-successful send.
 */
export async function sendListSentReminders(delayMinutes: number): Promise<ReminderSweepResult> {
  const web = isPushConfigured() && ensureVapid();
  const apns = createApnsSender();
  if (!web && !apns) {
    console.error("[push] reminders: not configured");
    return { candidates: 0, sent: 0 };
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[push] reminders: admin client not configured");
    return { candidates: 0, sent: 0 };
  }

  try {
    const cutoff = new Date(Date.now() - delayMinutes * 60_000).toISOString();

    // Capped per run: a household inbox this backed up needs attention
    // beyond a push reminder, and an unbounded sweep sharing one APNs
    // connection is exactly the kind of long tail that should stay off
    // this function's critical path.
    const { data: stale, error } = await admin
      .from("notifications")
      .select("id, user_id, list_id, actor_name")
      .eq("type", "list_sent")
      .is("read_at", null)
      .is("reminder_sent_at", null)
      .not("pushed_at", "is", null)
      .lt("pushed_at", cutoff)
      .limit(200);

    if (error) {
      console.error("[push] reminders: query error:", error.message);
      return { candidates: 0, sent: 0 };
    }
    if (!stale || stale.length === 0) return { candidates: 0, sent: 0 };

    const userIds = [...new Set(stale.map((row) => row.user_id))];
    const [{ data: users }, { data: subs }] = await Promise.all([
      admin.from("users").select("id, preferred_language").in("id", userIds),
      admin
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth_key, platform")
        .in("user_id", userIds),
    ]);

    const languageByUser = new Map((users ?? []).map((u) => [u.id, u.preferred_language]));
    const subsByUser = new Map<string, NonNullable<typeof subs>>();
    for (const sub of subs ?? []) {
      const list = subsByUser.get(sub.user_id);
      if (list) list.push(sub);
      else subsByUser.set(sub.user_id, [sub]);
    }

    const staleEndpoints: string[] = [];
    let sentCount = 0;

    await Promise.all(
      stale.map(async (row) => {
        const recipientSubs = subsByUser.get(row.user_id) ?? [];
        if (recipientSubs.length === 0) return;

        const messages = getMessages(languageByUser.get(row.user_id) ?? "en");
        const body = getMessage(messages, "notif.listSentReminder", {
          name: row.actor_name ?? getMessage(messages, "hlists.someone"),
        });
        const title = branding.name;
        const threadId = `list-${row.list_id}-list_sent`;
        const url = `/home/lists/${row.list_id}`;

        let delivered = false;

        await Promise.all(
          recipientSubs.map(async (sub) => {
            if (sub.platform === "ios") {
              if (!apns) return;
              const result = await apns.send(sub.endpoint.slice(APNS_PREFIX.length), {
                title,
                body,
                threadId,
                url,
              });
              if (result.ok) delivered = true;
              else if (result.gone) staleEndpoints.push(sub.endpoint);
              return;
            }

            if (!web || !sub.p256dh || !sub.auth_key) return;

            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
                JSON.stringify({ title, body, tag: threadId, url }),
              );
              delivered = true;
            } catch (err) {
              const statusCode = (err as { statusCode?: number }).statusCode;
              if (statusCode === 404 || statusCode === 410) staleEndpoints.push(sub.endpoint);
            }
          }),
        );

        if (delivered) sentCount++;
      }),
    );

    await admin
      .from("notifications")
      .update({ reminder_sent_at: new Date().toISOString() })
      .in(
        "id",
        stale.map((row) => row.id),
      );

    if (staleEndpoints.length > 0) {
      await admin.from("push_subscriptions").delete().in("endpoint", staleEndpoints);
    }

    return { candidates: stale.length, sent: sentCount };
  } catch (err) {
    console.error("[push] sendListSentReminders threw:", err);
    return { candidates: 0, sent: 0 };
  } finally {
    apns?.close();
  }
}
