"use client";

import { branding } from "@/lib/branding";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { safeNextPath } from "@/lib/auth/nextPath";
import {
  isValidPhone,
  KUWAIT_DIAL_CODE,
  LOCAL_NUMBER_LENGTH,
  normalizeDigits,
  OTP_CHANNEL,
  toE164FromLocal,
} from "@/lib/auth/phone";
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
  // Only the local digits. The +965 is a fixed chip in the UI, because
  // asking users to type a country code produced real failed sign-ins.
  const [localDigits, setLocalDigits] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = toE164FromLocal(localDigits);

    if (localDigits.length !== LOCAL_NUMBER_LENGTH || !isValidPhone(normalized)) {
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
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      {/* The app runs standalone (manifest display: "standalone"), so on
          iOS there is no OS-level back gesture and no browser chrome at
          all — without this, a visitor who opened /welcome, picked a
          language, and landed here had no way back to change it. Mirrors
          WorkerBar's back button for the same look everywhere in the app;
          `start-4` and the rtl:-scale-x-100 glyph flip keep it correct in
          Arabic/Urdu without a separate RTL variant. */}
      <Link
        href="/welcome"
        aria-label={t("common.back")}
        className="absolute start-4 top-4 flex size-12 items-center justify-center rounded-pill border border-sand bg-surface text-ink"
      >
        <span aria-hidden className="rtl:-scale-x-100 text-lg leading-none">
          ‹
        </span>
      </Link>

      <MachlaIcon size={56} variant="flat" title={branding.name} />

      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.phoneTitle")}</h1>
        <p className="hl-caption">{t("auth.phoneHint")}</p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="hl-label text-ink">{t("auth.phoneLabel")}</span>
          {/* dir="ltr" on the row: chip and digits must not swap sides in
              Arabic/Urdu — a phone number reads left-to-right everywhere. */}
          <div
            dir="ltr"
            className="flex min-h-12 items-stretch overflow-hidden rounded-lg border border-sand bg-surface focus-within:border-green-700"
          >
            <span
              aria-hidden
              className="flex select-none items-center gap-2 border-e border-sand bg-surface-2 px-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element --
                  a 4KB static SVG; the optimizer adds nothing. */}
              <img src="/flags/kw.svg" alt="" className="h-4 w-6 rounded-[2px]" />
              <span className="hl-body text-ink-muted">{KUWAIT_DIAL_CODE}</span>
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={localDigits}
              // No HTML maxLength — it would truncate the raw value before
              // stripping, dropping digits from a paste like "6506 8000".
              // Strip non-digits first, then cap (same rule as the OTP box).
              // A paste of the full number with country code still works:
              // "+96565068000" -> strip -> "96565068000" -> drop the 965.
              onChange={(event) => {
                let digits = normalizeDigits(event.target.value).replace(/\D/g, "");
                if (digits.startsWith("965") && digits.length > LOCAL_NUMBER_LENGTH) {
                  digits = digits.slice(3);
                }
                if (digits.startsWith("0")) {
                  digits = digits.replace(/^0+/, "");
                }
                setLocalDigits(digits.slice(0, LOCAL_NUMBER_LENGTH));
              }}
              className="hl-body min-w-0 flex-1 bg-transparent px-4 tracking-wide text-ink outline-none"
              aria-invalid={status === "error"}
              aria-label={t("auth.phoneLabel")}
            />
          </div>
        </label>

        {error ? (
          <p role="alert" className="hl-caption text-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={status === "sending" || localDigits.length !== LOCAL_NUMBER_LENGTH}
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
