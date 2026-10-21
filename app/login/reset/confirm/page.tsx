"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { branding } from "@/lib/branding";
import { exchangeRecoveryCodeAction, setNewPasswordAction } from "@/lib/auth/resetPassword";
import { ErrorText, PrimaryButton, TextField } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const ERROR_ID = "reset-confirm-error";

/** Step 2-3 of "forgot password" — see lib/auth/resetPassword.ts. The
 * emailed link lands here with `?code=`, exchanged for a recovery
 * session on mount before the "set a new password" form is even shown. */
function ConfirmForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const code = searchParams.get("code");

  const [exchangeStatus, setExchangeStatus] = useState<"pending" | "ok" | "error">(
    code ? "pending" : "error",
  );
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    exchangeRecoveryCodeAction(code).then((result) => {
      setExchangeStatus(result.ok ? "ok" : "error");
    });
  }, [code]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setStatus("error");
      setError(t("auth.completeAccount.passwordMismatch"));
      return;
    }

    setStatus("saving");
    setError(null);

    const result = await setNewPasswordAction(password);
    if (!result.ok) {
      setStatus("error");
      setError(
        t(
          result.code === "INVALID_PASSWORD"
            ? "auth.completeAccount.invalidPassword"
            : "auth.genericError",
        ),
      );
      return;
    }

    setStatus("done");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <MachlaIcon size={56} variant="flat" title={branding.name} />

      {exchangeStatus === "pending" ? (
        // Was a bare `return null` — a fully blank screen for however long
        // the code exchange takes, which this app's own loading/skeleton
        // convention (components/ui/States.tsx) exists specifically to
        // avoid elsewhere (2026-10-21 audit).
        <p className="hl-body text-ink-muted" role="status">
          {t("state.loading")}
        </p>
      ) : exchangeStatus === "error" ? (
        <p role="alert" className="hl-body text-center text-danger">
          {t("auth.genericError")}
        </p>
      ) : status === "done" ? (
        <>
          <p className="hl-body text-center text-ink">{t("auth.passwordUpdated")}</p>
          <PrimaryButton
            variant="solid"
            type="button"
            onClick={() => {
              router.push("/login");
              router.refresh();
            }}
          >
            {t("auth.backToLogin")}
          </PrimaryButton>
        </>
      ) : (
        <>
          <h1 className="hl-title text-ink">{t("auth.newPasswordTitle")}</h1>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <TextField
              label={t("auth.completeAccount.passwordLabel")}
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={status === "error"}
              aria-describedby={status === "error" ? ERROR_ID : undefined}
            />
            <TextField
              label={t("auth.completeAccount.confirmPasswordLabel")}
              type="password"
              dir="ltr"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={status === "error"}
              aria-describedby={status === "error" ? ERROR_ID : undefined}
            />

            <ErrorText id={ERROR_ID}>{error}</ErrorText>

            <PrimaryButton variant="solid" type="submit" disabled={status === "saving" || !password}>
              {status === "saving" ? t("auth.completeAccount.saving") : t("auth.setNewPassword")}
            </PrimaryButton>
          </form>
        </>
      )}
    </main>
  );
}

export default function ResetConfirmPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmForm />
    </Suspense>
  );
}
