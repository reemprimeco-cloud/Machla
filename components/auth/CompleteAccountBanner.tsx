"use client";

import Link from "next/link";

import { LockIcon } from "@/components/ui/Icons";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Phase 1 of removing OTP (20260919120000_email_password_identity.sql):
 * a standing, non-blocking nudge shown on the dashboard/worker home while
 * `account_completed_at` is still null — mirrors QuickInviteWorker's
 * shape (components/household/QuickInviteWorker.tsx) so the two read as
 * the same family of "one more thing worth doing" cards, and disappears
 * the same way that one does once its job is done.
 */
export function CompleteAccountBanner() {
  const { t } = useLocale();

  return (
    <Link
      href="/account/complete"
      className="flex min-h-16 items-center gap-3 rounded-lg border border-dashed border-primary bg-primary-tint px-4 text-start shadow-sm transition-transform duration-150 ease-hl active:scale-[0.98]"
    >
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-primary text-on-primary"
      >
        <LockIcon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="hl-label block text-ink">{t("auth.completeAccount.title")}</span>
        <span className="hl-caption block text-ink-muted">{t("auth.completeAccount.hint")}</span>
      </span>
    </Link>
  );
}
