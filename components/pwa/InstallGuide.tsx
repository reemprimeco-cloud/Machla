"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { Card } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * "Add to Home Screen" prompt.
 *
 * Worth more than a nicety on iOS specifically: Safari only grants the
 * Push API to a site the user has installed to the Home Screen (16.4+),
 * so for an iPhone household this banner is the *only* route to the
 * notifications PushToggle offers. On Android it buys a launcher icon
 * and a full-screen shell — push already works in the browser there.
 *
 * Two very different mechanics behind one component:
 *
 *   Chromium  fires `beforeinstallprompt`, which we keep and replay from
 *             a real click. Nothing is shown until the browser has said
 *             the app is installable, so this cannot promise an install
 *             the browser would refuse.
 *   iOS       has no such event and never will — installing is a manual
 *             Share ▸ Add to Home Screen. All we can do is say so, which
 *             is why that branch is instructions rather than a button.
 *
 * Renders nothing once installed (`display-mode: standalone`), and
 * nothing after it is dismissed.
 */

const DISMISSED_KEY = "machla_install_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Already on the Home Screen / in the TWA — nothing left to install. */
function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS predates display-mode: standalone for home-screen apps.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS is detected rather than announced, and only Safari can install:
 * in Chrome/Firefox on iOS the Share menu has no such item, so telling
 * those users to look for it would be wrong. iPadOS reports itself as a
 * Mac, hence the touch-points check. */
function isIOSSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    // Private mode can throw on localStorage; showing the banner is the
    // safe failure here, not hiding it.
    return false;
  }
}

const neverChanges = () => () => {};

/** Everything this component decides depends on `window`, so it must
 * decide it after hydration or the server and client would disagree.
 * useSyncExternalStore is how you say "this differs between the two" —
 * as opposed to setting a flag from an effect, which is the same answer
 * arrived at through an extra render React now warns about. */
function useIsClient(): boolean {
  return useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );
}

export function InstallGuide() {
  const { t } = useLocale();
  const isClient = useIsClient();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function onPrompt(event: Event) {
      event.preventDefault(); // stop Chrome's own mini-infobar
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onInstalled() {
      setHidden(true);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Not remembering the dismissal is survivable; it reappears next visit.
    }
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    // Either way the event is spent — Chrome refuses to replay one.
    await deferred.userChoice;
    setDeferred(null);
    setHidden(true);
  }

  if (!isClient || hidden || isInstalled() || wasDismissed()) return null;

  // Chromium tells us the app is installable and hands us the prompt;
  // iOS never will, so there the banner is instructions instead. Any
  // other browser gets nothing rather than advice it can't act on.
  const mode: "prompt" | "ios" | "hidden" = deferred
    ? "prompt"
    : isIOSSafari()
      ? "ios"
      : "hidden";
  if (mode === "hidden") return null;

  return (
    <Card className="border-primary-line bg-primary-tint">
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-2xl leading-none">
          📲
        </span>
        <div className="min-w-0 flex-1">
          <p className="hl-heading text-ink">{t("install.title")}</p>
          <p className="hl-caption mt-1">{t("install.hint")}</p>

          {mode === "ios" ? (
            <ol className="hl-caption mt-3 space-y-1 text-ink">
              <li>{t("install.iosStep1")}</li>
              <li>{t("install.iosStep2")}</li>
            </ol>
          ) : null}

          <div className="mt-3 flex items-center gap-4">
            {mode === "prompt" ? (
              <button
                type="button"
                onClick={install}
                className="hl-label min-h-10 rounded-pill bg-primary px-4 text-on-primary active:bg-primary-hover"
              >
                {t("install.button")}
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="hl-caption text-ink-muted underline underline-offset-4"
            >
              {t("install.later")}
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
