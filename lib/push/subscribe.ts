"use client";

import { deletePushSubscriptionAction, savePushSubscriptionAction } from "./actions";

/** web-push wants the VAPID key as a Uint8Array, but the browser API
 * accepts base64url. Standard conversion — no library needed for one
 * function. */
function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  // Not Uint8Array.from(...) — that infers Uint8Array<ArrayBufferLike>,
  // which pushManager.subscribe's applicationServerKey (BufferSource)
  // rejects; `new Uint8Array(length)` is backed by a concrete ArrayBuffer.
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export type PushSupport = "unsupported" | "denied" | "available";

export function getPushSupport(): PushSupport {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  return "available";
}

/** True if this browser currently holds a push subscription — the
 * source of truth for the Settings toggle's initial state, since a
 * subscription outlives the tab it was created in and isn't otherwise
 * visible to a freshly loaded page. */
export async function isSubscribed(): Promise<boolean> {
  if (getPushSupport() !== "available") return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

/** Requests permission (if not already granted), subscribes this
 * browser, and saves the subscription server-side. Returns false on any
 * failure — permission refused, subscribe rejected, save failed —
 * without throwing, since the only caller is a settings toggle that
 * just needs to know whether to show itself as on or off. */
export async function subscribeToPush(vapidPublicKey: string): Promise<boolean> {
  if (getPushSupport() === "unsupported") return false;

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;
  }
  if (Notification.permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const { ok } = await savePushSubscriptionAction({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    authKey: json.keys.auth,
  });
  return ok;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (getPushSupport() === "unsupported") return true;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return true;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const { ok } = await deletePushSubscriptionAction(endpoint);
  return ok;
}
