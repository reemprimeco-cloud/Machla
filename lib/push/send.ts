import "server-only";

import webpush from "web-push";

import { branding } from "@/lib/branding";
import { getMessage, getMessages } from "@/lib/i18n/messages";
import type { MessageKey } from "@/lib/i18n/messages";
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
  if (!web && !apns) return;

  try {
    const supabase = await createClient();
    const { data: pending, error } = await supabase.rpc("get_pending_pushes", {
      p_list_id: listId,
      p_type: type,
    });
    if (error || !pending || pending.length === 0) return;

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
          if (!apns) return;
          const result = await apns.send(row.endpoint.slice(APNS_PREFIX.length), {
            title,
            body,
            threadId,
            url,
          });
          if (result.ok) sentIds.push(row.notification_id);
          // Apple's permanent failures mean the same thing Web Push's
          // 404/410 does — the app was deleted, or this token was
          // minted against the other APNs environment. Either way it
          // will never be deliverable again.
          else if (result.gone) staleEndpoints.push(row.endpoint);
          return;
        }

        if (!web || !row.p256dh || !row.auth_key) return;

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
  } catch {
    // Never let a push failure surface to the caller of the action that
    // triggered it — see the function comment above.
  } finally {
    // The HTTP/2 session outlives the sends unless it is closed, and a
    // serverless invocation that never becomes idle is one that gets
    // killed mid-flight rather than frozen for reuse.
    apns?.close();
  }
}
