"use client";

import Link from "next/link";

import { HomeListLockup } from "@/components/brand/HomeListIcon";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Phase 1's placeholder shell, now driven entirely by the active locale
// from LocaleProvider instead of a hardcoded "en", and restyled with the
// HomeList UI Kit's tokens/wordmark (docs/design/BRAND.md) — proves
// messages, direction, fonts, and the change-language flow are wired
// together end to end. Real worker/household screens replace this in
// later phases.
export function HomeShell() {
  const { messages, t } = useLocale();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <HomeListLockup size={40} />

      <p className="hl-body text-ink-muted">{messages.app.tagline}</p>

      <div className="w-full rounded-xl border border-sand bg-surface p-5 shadow-sm">
        <p className="hl-label text-ink">{messages.common.comingSoon}</p>
      </div>

      <Link href="/welcome" className="hl-label text-green-700 underline underline-offset-4">
        {t("common.changeLanguage")}
      </Link>
    </main>
  );
}
