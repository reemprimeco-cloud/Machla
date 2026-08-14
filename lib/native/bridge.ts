"use client";

/**
 * The bridge between this web app and the iOS App Store shell.
 *
 * WHY IT LOOKS LIKE THIS AND NOT LIKE CAPACITOR
 *
 * Every "web app in a native shell" framework works by injecting a
 * JavaScript bridge into the page (a WKUserScript, injected at document
 * start). This app can't rely on that: `proxy.ts` serves a strict
 * `script-src 'self' 'nonce-…' 'strict-dynamic'`, an injected script
 * carries neither the nonce nor a hash we control, and WebKit is
 * entitled to refuse it. Weakening the CSP to admit a bridge would trade
 * the app's main XSS defence for packaging convenience.
 *
 * So the bridge uses the two channels a CSP cannot reach, because
 * neither one is a script the page loaded:
 *
 *   web -> native   window.webkit.messageHandlers.machla.postMessage()
 *                   — a host object WebKit installs on the window itself
 *   native -> web   webView.evaluateJavaScript(...) from Swift
 *                   — an explicit native evaluation, outside the
 *                     document's policy entirely
 *
 * The pleasant consequence is that `window.machla` below is also the
 * complete, readable definition of what the native app is allowed to do:
 * three requests in, two callbacks out, and no third-party runtime in
 * either direction.
 *
 * On every other platform — Safari, Chrome, the installed PWA, the
 * Android TWA — `isNativeApp()` is false and none of this runs. Push
 * there goes through the Push API as it always has (`lib/push/subscribe.ts`).
 */

/** Matches the WKScriptMessageHandler name registered in
 * ios/Machla/WebAppView.swift. Renaming one without the other silently
 * disables the bridge, which is why neither says the string twice. */
const HANDLER_NAME = "machla";

/**
 * Four states, each mapping to exactly one thing the toggle can look
 * like — which is why iOS's own "not determined" is not among them:
 *
 *   unsupported  not running in the native shell; the toggle uses the
 *                Push API instead and this module is inert
 *   off          notifications are not on. Either iOS was never asked,
 *                or the user turned them off in here. Identical to the
 *                user, so identical here.
 *   granted      permission given and this device is registered
 *   denied       refused at the OS level. iOS will not show the prompt a
 *                second time, so the only way back is the Settings app —
 *                the toggle says so and stays disabled rather than
 *                offering a tap that provably does nothing.
 */
export type NativePushStatus = "unsupported" | "off" | "granted" | "denied";

/** What the page may ask the shell to do. Deliberately small: anything
 * the web can already do for itself does not belong here. */
export type NativeRequest =
  | { type: "push:status" }
  | { type: "push:enable" }
  | { type: "push:disable" };

interface MessageHandler {
  postMessage: (body: unknown) => void;
}

declare global {
  interface Window {
    webkit?: { messageHandlers?: Record<string, MessageHandler | undefined> };
    /** Installed by NativeBridge.tsx; called from Swift. */
    machla?: {
      onPushToken: (token: string) => void;
      onPushStatus: (status: NativePushStatus) => void;
    };
  }
}

function handler(): MessageHandler | null {
  if (typeof window === "undefined") return null;
  return window.webkit?.messageHandlers?.[HANDLER_NAME] ?? null;
}

/**
 * True only inside the iOS App Store build.
 *
 * Not a user-agent sniff: the shell's own message handler either exists
 * or it does not, and nothing but the shell can create it. A user agent
 * can be spoofed and, more to the point, is shared with plain Safari —
 * where every one of these calls would silently do nothing.
 */
export function isNativeApp(): boolean {
  return handler() !== null;
}

export function postToNative(request: NativeRequest): void {
  handler()?.postMessage(request);
}

// ---------------------------------------------------------------------
// Push state
// ---------------------------------------------------------------------
//
// The native side pushes state at us — at launch, when the user answers
// the permission alert, and whenever APNs rotates the device token —
// rather than answering questions synchronously. That rules out a plain
// `getStatus()`, so this module holds the latest value and hands it to
// whoever is currently on screen. Which is a store, so `useSyncExternal-
// Store` in the toggle can read it without an effect.

let status: NativePushStatus = "unsupported";
/** The last token iOS gave us, kept so "turn notifications off" knows
 * which push_subscriptions row is this device's. */
let deviceToken: string | null = null;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeToNativePush(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getNativePushStatus(): NativePushStatus {
  return status;
}

/** Constant on the server, where there is no native shell — the third
 * argument `useSyncExternalStore` needs so the server render and the
 * first client render agree. */
export function getNativePushStatusOnServer(): NativePushStatus {
  return "unsupported";
}

export function setNativePushStatus(next: NativePushStatus): void {
  if (status === next) return;
  status = next;
  emit();
}

export function getNativeDeviceToken(): string | null {
  return deviceToken;
}

export function setNativeDeviceToken(token: string | null): void {
  deviceToken = token;
}

/** The APNs half of a push_subscriptions row's unique `endpoint`
 * (20260814100000_apns_push.sql). Built here, once, so the scheme is not
 * spelled out at each call site. */
export function apnsEndpoint(token: string): string {
  return `apns://${token}`;
}
