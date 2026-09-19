"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  completeAccountWithEmailAction,
  completeAccountWithUsernameAction,
  type CompleteAccountErrorCode,
} from "@/lib/auth/completeAccount";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Mode = "email" | "username";

const ERROR_KEYS: Record<CompleteAccountErrorCode, MessageKey> = {
  AUTH_REQUIRED: "auth.genericError",
  NOT_CONFIGURED: "auth.genericError",
  INVALID_EMAIL: "auth.completeAccount.invalidEmail",
  INVALID_USERNAME: "auth.completeAccount.invalidUsername",
  INVALID_PASSWORD: "auth.completeAccount.invalidPassword",
  EMAIL_TAKEN: "auth.completeAccount.emailTaken",
  USERNAME_TAKEN: "auth.completeAccount.usernameTaken",
  UNKNOWN: "auth.genericError",
};

interface CompleteAccountScreenProps {
  currentEmail: string | null;
  currentUsername: string | null;
  isSynthetic: boolean;
  homePath: string;
}

/**
 * Phase 1 of removing OTP (20260919120000_email_password_identity.sql):
 * an already-signed-in account adds an email/username + password. No OTP
 * step here — the caller's existing session is the authorization (see
 * lib/auth/completeAccount.ts).
 */
export function CompleteAccountScreen({
  currentEmail,
  currentUsername,
  isSynthetic,
  homePath,
}: CompleteAccountScreenProps) {
  const router = useRouter();
  const { t } = useLocale();

  const alreadyDone = Boolean(currentEmail || currentUsername);
  const [mode, setMode] = useState<Mode>(
    isSynthetic || currentUsername ? "username" : "email",
  );
  const [email, setEmail] = useState(isSynthetic ? "" : (currentEmail ?? ""));
  const [username, setUsername] = useState(currentUsername ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setStatus("error");
      setError(t("auth.completeAccount.passwordMismatch"));
      return;
    }

    setStatus("saving");
    setError(null);

    const result =
      mode === "email"
        ? await completeAccountWithEmailAction(email, password)
        : await completeAccountWithUsernameAction(username, password);

    if (!result.ok) {
      setStatus("error");
      setError(t(ERROR_KEYS[result.code]));
      return;
    }

    router.push(homePath);
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-6 py-16">
      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.completeAccount.title")}</h1>
        <p className="hl-caption">
          {alreadyDone
            ? t("auth.completeAccount.hintUpdate")
            : t("auth.completeAccount.hint")}
        </p>
      </div>

      <div className="flex gap-2 rounded-pill border border-line bg-surface p-1">
        {(["email", "username"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMode(tab)}
            className={`hl-label flex-1 rounded-pill px-4 py-2 transition-colors duration-150 ease-hl ${
              mode === tab ? "bg-primary text-on-primary" : "text-ink-muted"
            }`}
          >
            {tab === "email"
              ? t("auth.completeAccount.emailTab")
              : t("auth.completeAccount.usernameTab")}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        {mode === "email" ? (
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
        ) : (
          <label className="flex flex-col gap-2">
            <span className="hl-label text-ink">{t("auth.completeAccount.usernameLabel")}</span>
            <input
              type="text"
              dir="ltr"
              autoComplete="username"
              value={username}
              onChange={(event) =>
                setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))
              }
              className="hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary"
              aria-invalid={status === "error"}
            />
          </label>
        )}

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
          disabled={
            status === "saving" ||
            !password ||
            (mode === "email" ? !email : !username)
          }
          className="hl-label min-h-12 rounded-lg bg-primary px-4 text-on-primary shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
        >
          {status === "saving" ? t("auth.completeAccount.saving") : t("auth.completeAccount.save")}
        </button>

        <button
          type="button"
          onClick={() => router.push(homePath)}
          className="hl-caption text-primary underline underline-offset-4"
        >
          {alreadyDone ? t("common.back") : t("auth.completeAccount.later")}
        </button>
      </form>
    </main>
  );
}
