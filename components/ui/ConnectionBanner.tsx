"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * A persistent bar while the device is offline.
 *
 * Without it, a tap on "Add" appears to do nothing and the worker taps
 * again — the failure looks like the app being broken rather than the
 * signal being gone. Naming the cause is the whole point.
 *
 * Starts as "online" and corrects itself in an effect: `navigator` does
 * not exist during the server render, and reading it during the client
 * render would produce a hydration mismatch.
 */
export function ConnectionBanner() {
  const { t } = useLocale();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-20 flex min-h-10 items-center justify-center gap-2 bg-warning px-4 text-center text-cream"
    >
      <span aria-hidden>📡</span>
      <span className="hl-label">{t("state.offlineBanner")}</span>
    </div>
  );
}
