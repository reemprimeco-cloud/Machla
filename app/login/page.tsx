"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { HomeListIcon } from "@/components/brand/HomeListIcon";
import { safeNextPath } from "@/lib/auth/nextPath";
import { DEFAULT_PHONE_PREFIX, isValidPhone, normalizePhone, OTP_CHANNEL } from "@/lib/auth/phone";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/**
 * Phone number entry (docs/architecture/06-auth-otp-flow.md §3, master
 * plan Phase 3). Phone + OTP via Supabase Auth is the only sign-in
 * method — no email/password, no social login (06-auth-otp-flow.md §6).
 *
 * Carries an optional ?next= through to the verify step so an invitation
 * deep link (/join/<code>) returns the visitor to the invitation after
 * signing in.
 */
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const nextPath = safeNextPath(searchParams.get("next"));
  const [phone, setPhone] = useState(DEFAULT_PHONE_PREFIX);
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizePhone(phone);

    if (!isValidPhone(normalized)) {
      setStatus("error");
      setError(t("auth.invalidPhone"));
      return;
    }

    setStatus("sending");
    setError(null);

    if (!isSupabaseConfigured()) {
      setStatus("error");
      setError(t("auth.genericError"));
      return;
    }

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { channel: OTP_CHANNEL },
    });

    if (signInError) {
      setStatus("error");
      setError(t("auth.genericError"));
      return;
    }

    const params = new URLSearchParams({ phone: normalized });
    if (nextPath !== "/") params.set("next", nextPath);
    router.push(`/login/verify?${params.toString()}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <HomeListIcon size={56} variant="flat" title="HomeList" />

      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.phoneTitle")}</h1>
        <p className="hl-caption">{t("auth.phoneHint")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="hl-label text-ink">{t("auth.phoneLabel")}</span>
          <input
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="hl-body min-h-12 rounded-lg border border-sand bg-surface px-4 text-ink outline-none focus-visible:border-green-700"
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
          disabled={status === "sending"}
          className="hl-label min-h-12 rounded-lg bg-green-700 px-4 text-on-green shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
        >
          {status === "sending" ? t("auth.sending") : t("auth.sendCode")}
        </button>
      </form>
    </main>
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
