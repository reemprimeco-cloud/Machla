"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { HomeListLockup } from "@/components/brand/HomeListIcon";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

// Phase 3's authenticated placeholder shell — proves sign-in, session,
// profile, and logout are wired end to end. Real worker/household
// screens replace this once Phase 4 (households) exists.
export function HomeShell({ phoneNumber }: { phoneNumber: string }) {
  const router = useRouter();
  const { messages, t } = useLocale();
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    if (isSupabaseConfigured()) {
      const supabase = createClient();
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <HomeListLockup size={40} />

      <p className="hl-body text-ink-muted">{messages.app.tagline}</p>

      <div className="w-full space-y-3 rounded-xl border border-sand bg-surface p-5 shadow-sm">
        <p className="hl-label text-ink">{messages.common.comingSoon}</p>
        <p className="hl-caption">
          <bdi dir="ltr">{phoneNumber}</bdi>
        </p>
      </div>

      <div className="flex items-center gap-6">
        <Link href="/welcome" className="hl-label text-green-700 underline underline-offset-4">
          {t("common.changeLanguage")}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          disabled={signingOut}
          className="hl-label text-danger underline underline-offset-4 disabled:opacity-60"
        >
          {t("common.logout")}
        </button>
      </div>
    </main>
  );
}
