"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
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

  useEffect(() => {
    function detect() {
      const current = getPushSupport();
      setSupport(current);
      if (current === "available") isSubscribed().then(setEnabled);
    }
    detect();
  }, []);

  if (support === "unsupported") return null;

  async function handleChange(next: boolean) {
    setPending(true);
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
            {support === "denied" ? t("settings.pushBlocked") : t("settings.pushHint")}
          </span>
        </span>
        <input
          type="checkbox"
          checked={enabled}
          disabled={pending || support === "denied"}
          onChange={(event) => handleChange(event.target.checked)}
          className="size-7 shrink-0 accent-[var(--hl-primary)]"
        />
      </label>
    </Card>
  );
}
