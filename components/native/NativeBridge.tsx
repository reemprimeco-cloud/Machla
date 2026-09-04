"use client";

import { useEffect } from "react";

import {
  emitNativeIapProduct,
  emitNativeIapResult,
  isNativeApp,
  postToNative,
  setNativeDeviceToken,
  setNativePushStatus,
  type IapProductInfo,
  type IapPurchaseResult,
  type NativePushStatus,
} from "@/lib/native/bridge";
import { saveApnsTokenAction } from "@/lib/push/actions";

/**
 * Installs the two callbacks the iOS shell calls into
 * (`lib/native/bridge.ts` explains why the channel looks like this), and
 * nothing else. Renders no markup.
 *
 * Mounted in the root layout rather than in Settings on purpose: APNs
 * hands the app a device token at launch and can rotate it at any time,
 * for reasons that have nothing to do with what the user is looking at.
 * If only the Settings screen were listening, a rotated token would be
 * dropped and that iPhone would quietly stop receiving notifications
 * until someone happened to open Settings again.
 *
 * On every other platform this is a no-op — `isNativeApp()` is false, no
 * globals are defined, and nothing is sent anywhere.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!isNativeApp()) return;

    window.machla = {
      onPushToken(token: string) {
        setNativeDeviceToken(token);
        // Fire and forget: a failure here is not something the user did
        // or can fix, and the shell re-sends the token on every launch.
        void saveApnsTokenAction(token);
      },
      onPushStatus(status: NativePushStatus) {
        setNativePushStatus(status);
      },
      onIapProduct(info: IapProductInfo) {
        emitNativeIapProduct(info);
      },
      onIapResult(result: IapPurchaseResult) {
        emitNativeIapResult(result);
      },
    };

    // Ask rather than wait. The shell may have had a token in hand since
    // before this page finished loading — a launch straight into a
    // notification is exactly that case — and a push model would have
    // had to guess when React was ready to receive it.
    postToNative({ type: "push:status" });

    return () => {
      delete window.machla;
    };
  }, []);

  return null;
}
