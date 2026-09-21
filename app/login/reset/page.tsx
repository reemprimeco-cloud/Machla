"use client";

import Link from "next/link";
import { useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { branding } from "@/lib/branding";
import { requestPasswordResetAction } from "@/lib/auth/resetPassword";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/** Step 1 of "forgot password" — see lib/auth/resetPassword.ts. */
export default function ResetRequestPage() {
  const { t } = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const redirectTo = `${window.location.origin}/login/reset/confirm`;
    const result = await requestPasswordResetAction(email, redirectTo);

    if (!result.ok) {
      setStatus("error");
      setError(
        t(
          result.code === "INVALID_EMAIL"
            ? "auth.completeAccount.invalidEmail"
            : "auth.genericError",
        ),
      );
      return;
    }

    setStatus("sent");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <MachlaIcon size={56} variant="flat" title={branding.name} />

      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.resetTitle")}</h1>
        <p className="hl-caption">{t("auth.resetHint")}</p>
      </div>

      {status === "sent" ? (
        <p className="hl-body text-center text-ink">{t("auth.resetLinkSent")}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="hl-label text-ink">{t("auth.completeAccount.emailLabel")}</span>
            <input
              type="email"
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary"
              aria-invalid={status === "error"}
            />
          </label>

          {error ? (
            <p role="alert" className="hl-caption text-danger">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={status === "sending" || !email}
            className="hl-label min-h-12 rounded-lg bg-primary px-4 text-on-primary shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
          >
            {status === "sending" ? t("auth.sending") : t("auth.sendResetLink")}
          </button>
        </form>
      )}

      <Link href="/login" className="hl-caption text-primary underline underline-offset-4">
        {t("auth.backToLogin")}
      </Link>
    </main>
  );
}
