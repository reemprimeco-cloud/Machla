"use client";

import { branding } from "@/lib/branding";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { MachlaIcon } from "@/components/brand/MachlaIcon";
import { OTP_CHANNEL } from "@/lib/auth/phone";
import { safeNextPath } from "@/lib/auth/nextPath";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/**
 * Mirrors Supabase Auth's own minimum interval between OTP requests to
 * the same number. Enforced server-side regardless; this exists so the
 * user is told to wait instead of being shown a failure.
 */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * OTP entry (docs/architecture/06-auth-otp-flow.md §3). Supabase Auth
 * owns OTP generation/expiry/verification entirely — this page never
 * stores or re-derives the code itself (master plan rule 29.13).
 */
function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLocale();
  const phone = searchParams.get("phone") ?? "";
  const nextPath = safeNextPath(searchParams.get("next"));

  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "resending" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  // Every resend is a paid SMS, and Supabase Auth refuses a second OTP to
  // the same number inside 60s anyway ("For security purposes, you can
  // only request this after N seconds"). Without a visible countdown the
  // button looks broken and gets tapped repeatedly. Starts on mount
  // because arriving here means /login has just sent the first code.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (!phone) router.replace("/login");
  }, [phone, router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!phone) return null;

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setStatus("verifying");
    setError(null);
    setResent(false);

    if (!isSupabaseConfigured()) {
      setStatus("error");
      setError(t("auth.genericError"));
      return;
    }

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (verifyError) {
      setStatus("error");
      setError(t("auth.invalidCode"));
      return;
    }

    // Back to wherever sign-in was triggered from — an invitation deep
    // link, or the root route by default (lib/auth/nextPath.ts rejects
    // anything that isn't a same-site path).
    router.push(nextPath);
    // Forces the server-rendered tree (root layout + destination) to
    // re-run against the now-authenticated session immediately, instead
    // of potentially reusing a pre-login render — see app/layout.tsx's
    // preferred_language reconciliation, which depends on this.
    router.refresh();
  }

  async function handleResend() {
    setStatus("resending");
    setError(null);
    setResent(false);

    if (!isSupabaseConfigured()) {
      setStatus("error");
      setError(t("auth.genericError"));
      return;
    }

    const supabase = createClient();
    const { error: resendError } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: OTP_CHANNEL },
    });

    if (resendError) {
      setStatus("error");
      setError(t("auth.genericError"));
      return;
    }

    setStatus("idle");
    setResent(true);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <MachlaIcon size={56} variant="flat" title={branding.name} />

      <div className="space-y-1 text-center">
        <h1 className="hl-title text-ink">{t("auth.codeTitle")}</h1>
        {/* The phone number is wrapped in <bdi dir="ltr"> so its digits
            stay left-to-right inside RTL sentences (Arabic/Urdu) instead
            of visually reordering — see docs/design/UI_KIT_NOTES.md
            "Numbers stay LTR inside RTL". Split the raw (un-interpolated)
            template on the {phone} placeholder so each language's own
            word order around the number is preserved. */}
        <p className="hl-caption">
          {t("auth.codeSentTo")
            .split("{phone}")
            .map((part, index) => (
              <span key={index}>
                {index > 0 && <bdi dir="ltr">{phone}</bdi>}
                {part}
              </span>
            ))}
        </p>
      </div>

      <form onSubmit={handleVerify} className="flex w-full flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="hl-label text-ink">{t("auth.codeLabel")}</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            value={code}
            // No HTML maxLength: it would truncate the raw (pre-strip)
            // value first, so e.g. pasting "12ab3456" could drop digits
            // that were "pushed out" by the letters within the raw
            // 6-char window. Strip non-digits first, then cap at 6.
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="hl-title min-h-12 rounded-lg border border-sand bg-surface px-4 text-center tracking-[0.3em] text-ink outline-none focus-visible:border-green-700"
            aria-invalid={status === "error"}
          />
        </label>

        {error ? (
          <p role="alert" className="hl-caption text-danger">
            {error}
          </p>
        ) : null}
        {resent ? <p className="hl-caption text-success">{t("auth.codeResent")}</p> : null}

        <button
          type="submit"
          disabled={status === "verifying" || code.length !== 6}
          className="hl-label min-h-12 rounded-lg bg-green-700 px-4 text-on-green shadow-sm transition-colors duration-150 ease-hl disabled:opacity-60"
        >
          {status === "verifying" ? t("auth.verifying") : t("auth.verify")}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="hl-caption text-green-700 underline underline-offset-4"
          >
            {t("auth.changeNumber")}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={status === "resending" || cooldown > 0}
            className="hl-caption text-green-700 underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {cooldown > 0
              ? /* The count stays LTR inside Arabic/Urdu, same rule as the
                   phone number above. */
                t("auth.resendIn").split("{seconds}").map((part, index) => (
                  <span key={index}>
                    {index > 0 && <bdi dir="ltr">{cooldown}</bdi>}
                    {part}
                  </span>
                ))
              : t("auth.resendCode")}
          </button>
        </div>
      </form>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyForm />
    </Suspense>
  );
}
