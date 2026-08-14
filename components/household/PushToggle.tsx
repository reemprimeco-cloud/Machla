"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Card } from "@/components/ui/Primitives";
import {
  apnsEndpoint,
  getNativeDeviceToken,
  getNativePushStatus,
  getNativePushStatusOnServer,
  postToNative,
  subscribeToNativePush,
} from "@/lib/native/bridge";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { deletePushSubscriptionAction } from "@/lib/push/actions";
import { getPushSupport, isSubscribed, subscribeToPush, unsubscribeFromPush } from "@/lib/push/subscribe";

/**
 * The one push-notification control in the app: a single toggle, shared
 * by the household Settings screen and the worker's account actions
 * (components/household/AccountActions.tsx) — both are "this device's
 * account preferences" surfaces, and push is a per-device subscription,
 * not a per-role one.
 *
 * Renders nothing at all when the platform has no Push API (older
 * Safari, non-standalone iOS before 16.4) — a toggle that can never do
 * anything is worse than no toggle. Owns its own `Card` rather than
 * leaving that to callers: SettingsScreen used to wrap this in one
 * itself, which meant an empty, padded white box on every unsupported
 * browser (and briefly on every browser, before the client-only support
 * check resolves) — an empty wrapper is exactly as visible as a full
 * one until this component actually has something to put inside it.
 */
export function PushToggle() {
  const { t } = useLocale();
  // Starts as "unsupported" (renders nothing) and corrects itself in an
  // effect, same reasoning as ConnectionBanner: `Notification` does not
  // exist during the server render, and reading it during the client
  // render would produce a hydration mismatch.
  const [support, setSupport] = useState<"unsupported" | "denied" | "available">("unsupported");
  const [enabled, setEnabled] = useState(false);
  const [pending, setPending] = useState(false);

  // Inside the App Store build there is no Push API to ask, so the state
  // lives in the bridge's store and arrives from Swift. Unlike `support`
  // above this needs no effect: an external store is exactly what
  // useSyncExternalStore is for, and it stays consistent between the
  // server render and the first client one by returning "unsupported"
  // on the server.
  const nativeStatus = useSyncExternalStore(
    subscribeToNativePush,
    getNativePushStatus,
    getNativePushStatusOnServer,
  );
  const isNative = nativeStatus !== "unsupported";

  useEffect(() => {
    function detect() {
      const current = getPushSupport();
      setSupport(current);
      if (current === "available") isSubscribed().then(setEnabled);
    }
    detect();
  }, []);

  // A WKWebView has no PushManager, so on iOS `support` is permanently
  // "unsupported" and the native check has to come first — otherwise the
  // one platform that most needs this toggle is the one that never shows
  // it.
  if (!isNative && support === "unsupported") return null;

  const blocked = isNative ? nativeStatus === "denied" : support === "denied";
  const checked = isNative ? nativeStatus === "granted" : enabled;

  async function handleChange(next: boolean) {
    setPending(true);

    if (isNative) {
      if (next) {
        // The shell answers by calling back with the new status (and a
        // token, if the user allows it), so there is nothing to await:
        // the store updates when iOS has actually decided.
        postToNative({ type: "push:enable" });
      } else {
        // Turning notifications off has to remove the row as well as
        // unregister the device — iOS keeps the permission either way,
        // and a row left behind would keep this iPhone on the send list.
        const token = getNativeDeviceToken();
        postToNative({ type: "push:disable" });
        if (token) await deletePushSubscriptionAction(apnsEndpoint(token));
      }
      setPending(false);
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const ok = next
      ? Boolean(publicKey) && (await subscribeToPush(publicKey!))
      : await unsubscribeFromPush();
    if (ok) setEnabled(next);
    setPending(false);
  }

  return (
    <Card>
      <label className="flex min-h-12 items-center justify-between gap-4">
        <span className="min-w-0">
          <span className="hl-body block text-ink">{t("settings.pushEnable")}</span>
          <span className="hl-caption block">
            {blocked
              ? // Same state, two different places to go and undo it —
                // "your browser settings" is actively unhelpful advice
                // to someone holding the App Store build.
                t(isNative ? "settings.pushBlockedIos" : "settings.pushBlocked")
              : t("settings.pushHint")}
          </span>
        </span>
        <input
          type="checkbox"
          checked={checked}
          disabled={pending || blocked}
          onChange={(event) => handleChange(event.target.checked)}
          className="size-7 shrink-0 accent-[var(--hl-primary)]"
        />
      </label>
    </Card>
  );
}
