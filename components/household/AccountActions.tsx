"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ErrorText, useErrorMessage } from "@/components/ui/Primitives";
import { deleteAccountAction } from "@/lib/auth/deleteAccount";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

import { PushToggle } from "./PushToggle";

/** Change-language, log-out, and delete-account, shared by the household
 * and worker shells so both experiences always offer a way out. The
 * worker has no dedicated Settings screen the way the household does
 * (SettingsScreen.tsx) — this is the only account surface they get, so
 * the push toggle and account deletion live here for them instead.
 *
 * Delete-account was missing entirely for this surface until the
 * 2026-10-22 critique flagged it as a plausible Apple Guideline 5.1.1(v)
 * gap (every account type needs an in-app deletion path, not just the
 * household owner) — a worker is never an owner, so this always uses the
 * plain (non-household-deleting) confirm copy. Same action and same
 * no-window.confirm() reasoning as SettingsScreen.tsx. */
export function AccountActions() {
  const router = useRouter();
  const { t } = useLocale();
  const errorMessage = useErrorMessage();
  const [signingOut, setSigningOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
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

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteError(null);

    const result = await deleteAccountAction();

    setDeletingAccount(false);
    setConfirmingDelete(false);
    if (!result.ok) setDeleteError(errorMessage(result.code));
  }

  return (
    <div className="mt-auto flex flex-col gap-4 pt-6">
      <PushToggle />
      <div className="flex items-center justify-center gap-6">
        <Link
          href="/welcome"
          className="hl-caption text-primary underline underline-offset-4"
        >
          {t("common.changeLanguage")}
        </Link>
        <Link
          href="/privacy"
          className="hl-caption text-primary underline underline-offset-4"
        >
          {t("settings.privacy")}
        </Link>
        <Link
          href="/feedback"
          className="hl-caption text-primary underline underline-offset-4"
        >
          {t("settings.feedback")}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="hl-caption text-danger underline underline-offset-4 disabled:opacity-60"
        >
          {t("common.logout")}
        </button>
      </div>

      <ErrorText>{deleteError}</ErrorText>
      {confirmingDelete ? (
        <div className="flex flex-col gap-2 rounded-card-sm border border-glass-border bg-glass-bg p-3 shadow-card backdrop-blur-[20px]">
          <p className="hl-caption text-ink-muted">
            {t("settings.deleteAccountConfirm")}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={deletingAccount}
              onClick={handleDeleteAccount}
              className="hl-label flex-1 rounded-lg bg-danger px-3 py-2 text-on-primary disabled:opacity-60"
            >
              {deletingAccount ? t("settings.deletingAccount") : t("settings.deleteAccount")}
            </button>
            <button
              type="button"
              disabled={deletingAccount}
              onClick={() => setConfirmingDelete(false)}
              className="hl-label flex-1 rounded-lg border border-glass-border-strong bg-glass-bg-strong px-3 py-2 text-ink-muted backdrop-blur-[20px] disabled:opacity-60"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="hl-caption text-danger underline underline-offset-4"
        >
          {t("settings.deleteAccount")}
        </button>
      )}
    </div>
  );
}
