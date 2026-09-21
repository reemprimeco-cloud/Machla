"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { branding } from "@/lib/branding";
import { exchangeRecoveryCodeAction, setNewPasswordAction } from "@/lib/auth/resetPassword";
import { useLocale } from "@/lib/i18n/LocaleProvider";

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

  if (exchangeStatus === "pending") return null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <MachlaIcon size={56} variant="flat" title={branding.name} />

      {exchangeStatus === "error" ? (
        <p role="alert" className="hl-body text-center text-danger">
          {t("auth.genericError")}
        </p>
      ) : status === "done" ? (
        <>
          <p className="hl-body text-center text-ink">{t("auth.passwordUpdated")}</p>
          <button
            type="button"
            onClick={() => {
              router.push("/login");
              router.refresh();
            }}
            className="hl-label min-h-12 rounded-lg bg-primary px-4 text-on-primary shadow-sm"
          >
            {t("auth.backToLogin")}
          </button>
        </>
      ) : (
        <>
          <h1 className="hl-title text-ink">{t("auth.newPasswordTitle")}</h1>
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="hl-label text-ink">{t("auth.completeAccount.passwordLabel")}</span>
              <input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary"
                aria-invalid={status === "error"}
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="hl-label text-ink">
                {t("auth.completeAccount.confirmPasswordLabel")}
              </span>
              <input
                type="password"
                dir="ltr"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
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
              disabled={status === "saving" || !password}
              className="hl-label min-h-12 rounded-lg bg-primary px-4 text-on-primary shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
            >
              {status === "saving" ? t("auth.completeAccount.saving") : t("auth.setNewPassword")}
            </button>
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
