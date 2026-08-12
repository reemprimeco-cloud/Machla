import "server-only";

import webpush from "web-push";

import { branding } from "@/lib/branding";
import { getMessage, getMessages } from "@/lib/i18n/messages";
import type { MessageKey } from "@/lib/i18n/messages";
import type { NotificationType } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

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

/**
 * Reads back this caller's own fallout from the status change they just
 * made (get_pending_pushes — scoped to actor_user_id = auth.uid(), see
 * 20260812140000_push_notifications.sql), sends one push per subscribed
 * recipient translated into THEIR OWN preferred_language, and marks
 * whichever sends succeeded.
 *
 * Best-effort by design, same as markListViewedAction: a push that
 * fails to send must never fail the caller's action, and every call
 * site awaits this only after its own RPC already succeeded. Errors are
 * swallowed here, not re-thrown, for the same reason.
 */
export async function sendPendingPushes(listId: string, type: NotificationType): Promise<void> {
  if (!isPushConfigured() || !ensureVapid()) return;

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
        const payload = JSON.stringify({
          title: branding.name,
          body,
          tag: `list-${listId}-${type}`,
          url: row.is_household_side ? `/home/lists/${listId}` : "/worker/lists",
        });

        try {
          await webpush.sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
            payload,
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
  }
}
