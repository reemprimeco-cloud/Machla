"use client";

import Link from "next/link";
import { branding } from "@/lib/branding";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { safeNextPath } from "@/lib/auth/nextPath";
import { signInAction } from "@/lib/auth/signIn";
import { signUpWithEmailAction, signUpWithUsernameAction } from "@/lib/auth/signUp";
import {
  COUNTRY_CODES_PINNED,
  countryLabel,
  sortedRestOfWorld,
} from "@/lib/i18n/countries";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

type Mode = "signin" | "signup";
type SignUpTab = "email" | "username";

/**
 * Phase 2 of removing OTP (20260920110000_phone_optional_identity.sql):
 * email/username + password is the only sign-in method now — no phone,
 * no OTP, open to anyone in the world. Carries an optional ?next=
 * through so an invitation deep link (/join/<code>) returns the visitor
 * to the invitation after signing in/up, same as the old phone flow did.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const nextPath = safeNextPath(searchParams.get("next"));

  const [mode, setMode] = useState<Mode>("signin");

  function handleAuthenticated() {
    router.push(nextPath);
    // Forces the server-rendered tree to re-run against the
    // now-authenticated session immediately (see app/layout.tsx's
    // preferred_language reconciliation, which depends on this).
    router.refresh();
  }

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      {/* The app runs standalone (manifest display: "standalone"), so on
          iOS there is no OS-level back gesture and no browser chrome at
          all — without this, a visitor who opened /welcome, picked a
          language, and landed here had no way back to change it. */}
      <Link
        href="/welcome"
        aria-label={t("common.back")}
        className="absolute start-4 top-4 flex size-12 items-center justify-center rounded-pill border border-line bg-surface text-ink"
      >
        <span aria-hidden className="rtl:-scale-x-100 text-lg leading-none">
          ‹
        </span>
      </Link>

      <MachlaIcon size={56} variant="flat" title={branding.name} />

      <p className="hl-heading -mt-4 text-center text-ink">{t("auth.welcomeGreeting")}</p>

      {mode === "signin" ? (
        <SignInForm onAuthenticated={handleAuthenticated} onSwitchToSignUp={() => setMode("signup")} />
      ) : (
        <SignUpForm onAuthenticated={handleAuthenticated} onSwitchToSignIn={() => setMode("signin")} />
      )}
    </main>
  );
}

function SignInForm({
  onAuthenticated,
  onSwitchToSignUp,
}: {
  onAuthenticated: () => void;
  onSwitchToSignUp: () => void;
}) {
  const { t } = useLocale();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const result = await signInAction(identifier, password);
    if (!result.ok) {
      setStatus("error");
      setError(
        t(
          result.code === "INVALID_CREDENTIALS"
            ? "auth.invalidCredentials"
            : "auth.genericError",
        ),
      );
      return;
    }

    onAuthenticated();
  }

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.signInTitle")}</h1>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="hl-label text-ink">{t("auth.identifierLabel")}</span>
          <input
            type="text"
            dir="ltr"
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary"
            aria-invalid={status === "error"}
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="hl-label text-ink">{t("auth.completeAccount.passwordLabel")}</span>
          <input
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary"
            aria-invalid={status === "error"}
          />
        </label>

        {error ? (
          <p role="alert" className="hl-caption text-danger">
            {error}
          </p>
        ) : null}

        <Link
          href="/login/reset"
          className="hl-caption self-end text-primary underline underline-offset-4"
        >
          {t("auth.forgotPassword")}
        </Link>

        <button
          type="submit"
          disabled={status === "sending" || !identifier || !password}
          className="hl-label min-h-12 rounded-lg bg-primary px-4 text-on-primary shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
        >
          {status === "sending" ? t("auth.signingIn") : t("auth.signIn")}
        </button>

        <p className="hl-caption text-center text-ink-muted">
          {t("auth.noAccountYet")}{" "}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-primary underline underline-offset-4"
          >
            {t("auth.createAccount")}
          </button>
        </p>
      </form>
    </>
  );
}

const SIGNUP_ERROR_KEYS: Record<string, MessageKey> = {
  NOT_CONFIGURED: "auth.genericError",
  INVALID_EMAIL: "auth.completeAccount.invalidEmail",
  INVALID_USERNAME: "auth.completeAccount.invalidUsername",
  INVALID_PASSWORD: "auth.completeAccount.invalidPassword",
  EMAIL_TAKEN: "auth.completeAccount.emailTaken",
  USERNAME_TAKEN: "auth.completeAccount.usernameTaken",
  UNKNOWN: "auth.genericError",
};

function SignUpForm({
  onAuthenticated,
  onSwitchToSignIn,
}: {
  onAuthenticated: () => void;
  onSwitchToSignIn: () => void;
}) {
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<SignUpTab>("email");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (password !== confirmPassword) {
      setStatus("error");
      setError(t("auth.completeAccount.passwordMismatch"));
      return;
    }

    setStatus("sending");
    setError(null);

    const result =
      tab === "email"
        ? await signUpWithEmailAction(email, password, country || null)
        : await signUpWithUsernameAction(username, password, country || null);

    if (!result.ok) {
      setStatus("error");
      setError(t(SIGNUP_ERROR_KEYS[result.code] ?? "auth.genericError"));
      return;
    }

    onAuthenticated();
  }

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.signUpTitle")}</h1>
      </div>

      <div className="flex w-full gap-2 rounded-pill border border-line bg-surface p-1">
        {(["email", "username"] as const).map((tabOption) => (
          <button
            key={tabOption}
            type="button"
            onClick={() => setTab(tabOption)}
            className={`hl-label flex-1 rounded-pill px-4 py-2 transition-colors duration-150 ease-hl ${
              tab === tabOption ? "bg-primary text-on-primary" : "text-ink-muted"
            }`}
          >
            {tabOption === "email"
              ? t("auth.completeAccount.emailTab")
              : t("auth.completeAccount.usernameTab")}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        {tab === "email" ? (
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
          <span className="hl-label text-ink">{t("auth.completeAccount.countryLabel")}</span>
          <select
            value={country}
            onChange={(event) => setCountry(event.target.value)}
            className="hl-body min-h-12 rounded-lg border border-line bg-surface px-4 text-ink outline-none focus-visible:border-primary"
            aria-invalid={status === "error"}
          >
            <option value="">{t("auth.completeAccount.countryPlaceholder")}</option>
            {COUNTRY_CODES_PINNED.map((code) => (
              <option key={code} value={code}>
                {countryLabel(code, locale)}
              </option>
            ))}
            <option disabled>——</option>
            {sortedRestOfWorld(locale).map((code) => (
              <option key={code} value={code}>
                {countryLabel(code, locale)}
              </option>
            ))}
          </select>
        </label>

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
            status === "sending" ||
            !password ||
            !country ||
            (tab === "email" ? !email : !username)
          }
          className="hl-label min-h-12 rounded-lg bg-primary px-4 text-on-primary shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
        >
          {status === "sending" ? t("auth.signingUp") : t("auth.signUp")}
        </button>

        <p className="hl-caption text-center text-ink-muted">
          {t("auth.alreadyHaveAccount")}{" "}
          <button
            type="button"
            onClick={onSwitchToSignIn}
            className="text-primary underline underline-offset-4"
          >
            {t("auth.signInLink")}
          </button>
        </p>
      </form>
    </>
  );
}

// useSearchParams requires a Suspense boundary in the App Router.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
