"use client";

import Link from "next/link";
import { useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { branding } from "@/lib/branding";
import { requestPasswordResetAction } from "@/lib/auth/resetPassword";
import { ErrorText, PrimaryButton, TextField } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const ERROR_ID = "reset-request-error";

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
          <TextField
            label={t("auth.completeAccount.emailLabel")}
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={status === "error"}
            aria-describedby={status === "error" ? ERROR_ID : undefined}
          />

          <ErrorText id={ERROR_ID}>{error}</ErrorText>

          <PrimaryButton variant="solid" type="submit" disabled={status === "sending" || !email}>
            {status === "sending" ? t("auth.sending") : t("auth.sendResetLink")}
          </PrimaryButton>
        </form>
      )}

      <Link href="/login" className="hl-caption text-primary underline underline-offset-4">
        {t("auth.backToLogin")}
      </Link>
    </main>
  );
}
