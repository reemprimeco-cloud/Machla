"use client";

import Link from "next/link";

import { branding } from "@/lib/branding";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Phase 1's placeholder shell, now driven entirely by the active locale
// from LocaleProvider instead of a hardcoded "en" — proves messages,
// direction, and the change-language flow are wired together end to end.
// Real worker/household screens replace this in later phases.
export function HomeShell() {
  const { messages, t } = useLocale();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-brand-foreground shadow-sm">
        <span className="text-3xl font-semibold">H</span>
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{branding.name}</h1>
        <p className="text-base text-neutral-600">{messages.app.tagline}</p>
      </div>

      <div className="w-full rounded-2xl border border-neutral-200 p-5 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800">{messages.common.comingSoon}</p>
      </div>

      <Link href="/welcome" className="text-sm font-medium text-brand underline underline-offset-4">
        {t("common.changeLanguage")}
      </Link>
    </main>
  );
}
