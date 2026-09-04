"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PushToggle } from "@/components/household/PushToggle";
import { Card, ErrorText, Screen, useErrorMessage } from "@/components/ui/Primitives";
import { deleteAccountAction } from "@/lib/auth/deleteAccount";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import type { HouseholdRole, SubscriptionStatus } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/** The Settings tab: who's signed in, what language they see the app in,
 * the current household's people/invitations, and signing out.
 * Grouped-list styling (iOS Settings-app style) rather than the
 * card-per-action pattern the household dashboard uses — this screen is
 * a flat list of account facts and destinations, not a set of cards to
 * browse. People/Invitations moved here from the dashboard (2026-08
 * feedback) so the dashboard stays focused on the lists themselves. */
export function SettingsScreen({
  phoneNumber,
  displayName,
  role,
  memberCount,
  subscriptionStatus,
  subscriptionHasAccess,
  trialActive,
  trialDaysLeft,
}: {
  phoneNumber: string;
  displayName: string | null;
  role: HouseholdRole;
  memberCount: number;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionHasAccess: boolean;
  trialActive: boolean;
  trialDaysLeft: number;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const errorMessage = useErrorMessage();
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleLogout() {
    setSigningOut(true);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  /** Apple Guideline 5.1.1(v): account deletion, not deactivation, from
   * inside the app. Owners get a sharper warning — deleting their
   * account also deletes the household they own, for everyone
   * (lib/auth/deleteAccount.ts). `deleteAccountAction` redirects on
   * success, so `result` is only ever reached on failure. */
  async function handleDeleteAccount() {
    const confirmKey =
      role === "owner"
        ? "settings.deleteAccountConfirmOwner"
        : "settings.deleteAccountConfirm";
    if (!window.confirm(t(confirmKey))) return;

    setDeletingAccount(true);
    setDeleteError(null);

    const result = await deleteAccountAction();

    setDeletingAccount(false);
    if (!result.ok) setDeleteError(errorMessage(result.code));
  }

  return (
    <Screen title={t("settings.title")}>
      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("settings.profile")}</h2>
        <Card className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-primary-tint text-2xl leading-none"
          >
            👤
          </span>
          <span className="min-w-0 flex-1">
            <span className="hl-heading block truncate text-ink">
              {displayName || t("members.unnamed")}
            </span>
            <bdi dir="ltr" className="hl-caption block">
              {phoneNumber}
            </bdi>
          </span>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("settings.subscription")}</h2>
        <Link
          href="/home/paywall"
          className="flex items-center justify-between rounded-lg border border-line bg-surface px-5 py-4 shadow-sm active:bg-surface-2"
        >
          <span className="hl-body text-ink">
            {subscriptionStatus === "active" || subscriptionStatus === "grace_period"
              ? t("settings.subscriptionActive")
              : trialActive
                ? t("paywall.trialDaysLeft", { days: trialDaysLeft })
                : subscriptionStatus === "none"
                  ? t("paywall.trialExpired")
                  : t("paywall.subscriptionExpired")}
          </span>
          <span className="hl-caption flex items-center gap-2 text-primary">
            {subscriptionHasAccess ? t("settings.manageSubscription") : t("paywall.subscribe")}
            <span aria-hidden className="rtl:-scale-x-100">
              ›
            </span>
          </span>
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("settings.general")}</h2>
        <Card className="overflow-hidden !p-0">
          <Link
            href="/welcome"
            className="flex min-h-14 items-center justify-between border-b border-line px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">
              {t("common.changeLanguage")}
            </span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
          <Link
            href="/home/settings/about"
            className="flex min-h-14 items-center justify-between border-b border-line px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("settings.about")}</span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
          <Link
            href="/home/settings/privacy"
            className="flex min-h-14 items-center justify-between border-b border-line px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("settings.privacy")}</span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
          <Link
            href="/home/settings/support"
            className="flex min-h-14 items-center justify-between px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("settings.support")}</span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
        </Card>
      </section>

      <section className="space-y-2">
        <PushToggle />
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("home.title")}</h2>
        <Card className="overflow-hidden !p-0">
          <Link
            href="/home/members"
            className="flex min-h-14 items-center justify-between border-b border-line px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("home.people")}</span>
            <span className="hl-caption flex items-center gap-2 text-ink-muted">
              {t("home.peopleCount", { count: memberCount })}
              <span aria-hidden className="rtl:-scale-x-100">
                ›
              </span>
            </span>
          </Link>
          {/* Invitation management is owner-only — the route itself also
              redirects a non-owner, and the RPCs refuse them regardless
              (docs/architecture/04-roles-permission-matrix.md). */}
          {role === "owner" ? (
            <Link
              href="/home/invitations"
              className="flex min-h-14 items-center justify-between px-4 active:bg-surface-2"
            >
              <span className="hl-body text-ink">{t("home.invitations")}</span>
              <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
                ›
              </span>
            </Link>
          ) : null}
        </Card>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
        className="hl-label min-h-12 rounded-lg border border-danger px-4 text-danger disabled:opacity-60"
      >
        {t("common.logout")}
      </button>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("settings.dangerZone")}</h2>
        <ErrorText>{deleteError}</ErrorText>
        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deletingAccount}
          className="hl-label min-h-12 w-full rounded-lg border border-danger px-4 text-danger disabled:opacity-60"
        >
          {deletingAccount
            ? t("settings.deletingAccount")
            : t("settings.deleteAccount")}
        </button>
      </section>

      {/* A fixed, un-translated line by design — a copyright notice reads
          the same in every language, the way a URL does. */}
      <p className="hl-caption pb-2 pt-6 text-center text-ink-faint">
        Copyright © reemora.app 2026
      </p>
    </Screen>
  );
}
