"use client";

import { useRouter } from "next/navigation";

import { branding } from "@/lib/branding";
import { LOCALES } from "@/lib/i18n/config";
import type { LocaleCode } from "@/lib/i18n/config";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Phase 2 "Language" screen (master plan route map: /welcome). Deliberately
// carries no instruction text ("choose your language" etc.) — before a
// locale is picked there is no single language to render that text in,
// and for a low-literacy audience the native-script grid is meant to be
// self-explanatory without it. Large tap targets, native script as the
// primary label, English as a small secondary hint, an optional flag as
// an extra visual cue.
export default function WelcomePage() {
  const router = useRouter();
  const { setLocale } = useLocale();

  function choose(code: LocaleCode) {
    setLocale(code);
    router.push("/");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center gap-6 px-4 py-10">
      <div className="flex flex-col items-center gap-1">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-2xl font-semibold text-brand-foreground">
          H
        </div>
        <p className="text-sm text-neutral-500">{branding.name}</p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
        {LOCALES.map((locale) => (
          <button
            key={locale.code}
            type="button"
            onClick={() => choose(locale.code)}
            dir={locale.direction}
            lang={locale.code}
            aria-label={`${locale.nativeName} (${locale.englishName})`}
            className="flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-neutral-200 bg-white p-4 text-center shadow-sm transition active:scale-95 active:bg-neutral-50"
          >
            {locale.flag ? (
              <span className="text-3xl leading-none" aria-hidden="true">
                {locale.flag}
              </span>
            ) : null}
            <span className="text-lg font-semibold text-neutral-900">{locale.nativeName}</span>
            {locale.nativeName !== locale.englishName ? (
              <span className="text-xs text-neutral-500">{locale.englishName}</span>
            ) : null}
          </button>
        ))}
      </div>
    </main>
  );
}
