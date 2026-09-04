"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, ErrorText, PrimaryButton, SecondaryButton, Screen } from "@/components/ui/Primitives";
import {
  isNativeApp,
  onNativeIapProduct,
  onNativeIapResult,
  purchaseSubscription,
  requestIapProduct,
  restorePurchases,
  type IapProductInfo,
  type IapPurchaseResult,
} from "@/lib/native/bridge";
import { syncAppleSubscriptionAction } from "@/lib/subscription/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";
import type { SubscriptionStatus } from "@/lib/supabase/database.types";

const FAILURE_KEYS: Record<Exclude<IapPurchaseResult, { ok: true }>["reason"], MessageKey> = {
  cancelled: "paywall.cancelled",
  pending: "paywall.pending",
  failed: "paywall.failed",
  not_found: "paywall.restoreNotFound",
};

/**
 * The one screen a household sees once its free trial (or subscription)
 * has run out — `requireActiveSubscription` (lib/household/guard.ts)
 * sends every gated page here instead of letting it render.
 *
 * Purchasing only works inside the native iOS shell: StoreKit has no web
 * equivalent, and per the product decision this app does not sell the
 * subscription any other way yet. A household with nobody on iPhone has
 * no purchase path at all right now — the copy below says so plainly
 * rather than showing a button that can never do anything.
 */
export function PaywallScreen({
  householdId,
  subscriptionStatus,
  trialActive,
  trialDaysLeft,
  alreadyHasAccess,
}: {
  householdId: string;
  subscriptionStatus: SubscriptionStatus | null;
  /** Precomputed server-side (app/home/paywall/page.tsx) rather than
   * derived here from `new Date()`/`Date.now()` — React treats calling
   * either during render as impure, and the answer only ever needs to
   * be as fresh as the page's own load anyway. */
  trialActive: boolean;
  trialDaysLeft: number;
  alreadyHasAccess: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const native = isNativeApp();

  const [product, setProduct] = useState<IapProductInfo | null>(null);
  const [busy, setBusy] = useState<"purchase" | "restore" | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!native) return;

    const offProduct = onNativeIapProduct(setProduct);
    const offResult = onNativeIapResult((result) => {
      setBusy(null);
      if (!result.ok) {
        setError(FAILURE_KEYS[result.reason]);
        return;
      }
      setError(null);
      void (async () => {
        const ok = await syncAppleSubscriptionAction(householdId, result.originalTransactionId);
        if (!ok) {
          setError("paywall.failed");
          return;
        }
        setSuccess(true);
        router.refresh();
      })();
    });

    requestIapProduct();

    return () => {
      offProduct();
      offResult();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  if (success || alreadyHasAccess) {
    return (
      <Screen title={t("paywall.title")}>
        <Card>
          <p className="hl-heading text-ink">{t("paywall.success")}</p>
        </Card>
        <PrimaryButton onClick={() => router.push("/home/dashboard")}>
          {t("paywall.continue")}
        </PrimaryButton>
      </Screen>
    );
  }

  return (
    <Screen title={t("paywall.title")} description={t("paywall.subtitle")}>
      <Card>
        <p className="hl-body text-ink">
          {trialActive
            ? t("paywall.trialDaysLeft", { days: trialDaysLeft })
            : subscriptionStatus === "none"
              ? t("paywall.trialExpired")
              : t("paywall.subscriptionExpired")}
        </p>
        {product ? (
          <p className="hl-heading mt-2 text-ink">
            {t("paywall.priceLine", { price: product.priceDisplay })}
          </p>
        ) : null}
      </Card>

      <ul className="hl-body flex flex-col gap-2 text-ink-muted">
        <li>• {t("paywall.benefitLists")}</li>
        <li>• {t("paywall.benefitHousehold")}</li>
        <li>• {t("paywall.benefitNotifications")}</li>
      </ul>

      {native ? (
        <div className="flex flex-col gap-3">
          <PrimaryButton
            disabled={busy !== null}
            onClick={() => {
              setBusy("purchase");
              setError(null);
              purchaseSubscription();
            }}
          >
            {busy === "purchase" ? t("paywall.purchasing") : t("paywall.subscribe")}
          </PrimaryButton>
          <SecondaryButton
            disabled={busy !== null}
            onClick={() => {
              setBusy("restore");
              setError(null);
              restorePurchases();
            }}
          >
            {busy === "restore" ? t("paywall.restoring") : t("paywall.restore")}
          </SecondaryButton>
          <ErrorText>{error ? t(error) : null}</ErrorText>
        </div>
      ) : (
        <Card>
          <p className="hl-body text-ink">{t("paywall.iosOnly")}</p>
        </Card>
      )}
    </Screen>
  );
}
