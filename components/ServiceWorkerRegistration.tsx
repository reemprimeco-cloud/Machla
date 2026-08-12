"use client";

import { useEffect } from "react";

/**
 * Registers the Phase 1 minimal service worker (public/sw.js). Skipped in
 * development so it doesn't fight with Next.js's dev server/HMR.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Non-fatal: the app works without an installed service worker.
    });
  }, []);

  return null;
}
