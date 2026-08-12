"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Card, Screen } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/** The Settings tab: who's signed in, what language they see the app in,
 * and signing out. Grouped-list styling (iOS Settings-app style) rather
 * than the card-per-action pattern the household dashboard uses — this
 * screen is a short, flat list of account facts and two actions, not a
 * set of destinations to browse. */
export function SettingsScreen({
  phoneNumber,
  displayName,
}: {
  phoneNumber: string;
  displayName: string | null;
}) {
  const router = useRouter();
  const { t } = useLocale();
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
    <Screen title={t("settings.title")}>
      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("settings.profile")}</h2>
        <Card className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-green-100 text-2xl leading-none"
          >
            👤
          </span>
          <span className="min-w-0 flex-1">
            <span className="hl-heading block truncate text-ink">
              {displayName || t("members.unnamed")}
            </span>
            <bdi dir="ltr" className="hl-caption block">
              {phoneNumber}
            </bdi>
          </span>
        </Card>
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("settings.general")}</h2>
        <Card className="overflow-hidden !p-0">
          <Link
            href="/welcome"
            className="flex min-h-14 items-center justify-between px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("common.changeLanguage")}</span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
        </Card>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        disabled={signingOut}
        className="hl-label min-h-12 rounded-lg border border-danger px-4 text-danger disabled:opacity-60"
      >
        {t("common.logout")}
      </button>
    </Screen>
  );
}
