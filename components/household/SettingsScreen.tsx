"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PushToggle } from "@/components/household/PushToggle";
import { Card, Screen } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { createClient } from "@/lib/supabase/client";
import type { HouseholdRole } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";

/** The Settings tab: who's signed in, what language they see the app in,
 * the current household's people/invitations, and signing out.
 * Grouped-list styling (iOS Settings-app style) rather than the
 * card-per-action pattern the household dashboard uses — this screen is
 * a flat list of account facts and destinations, not a set of cards to
 * browse. People/Invitations moved here from the dashboard (2026-08
 * feedback) so the dashboard stays focused on the lists themselves. */
export function SettingsScreen({
  phoneNumber,
  displayName,
  role,
  memberCount,
}: {
  phoneNumber: string;
  displayName: string | null;
  role: HouseholdRole;
  memberCount: number;
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
            className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-primary-tint text-2xl leading-none"
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
            className="flex min-h-14 items-center justify-between border-b border-line px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">
              {t("common.changeLanguage")}
            </span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
          <Link
            href="/home/settings/about"
            className="flex min-h-14 items-center justify-between px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("settings.about")}</span>
            <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
              ›
            </span>
          </Link>
        </Card>
      </section>

      <section className="space-y-2">
        <PushToggle />
      </section>

      <section className="space-y-2">
        <h2 className="hl-label text-ink-muted">{t("home.title")}</h2>
        <Card className="overflow-hidden !p-0">
          <Link
            href="/home/members"
            className="flex min-h-14 items-center justify-between border-b border-line px-4 active:bg-surface-2"
          >
            <span className="hl-body text-ink">{t("home.people")}</span>
            <span className="hl-caption flex items-center gap-2 text-ink-muted">
              {t("home.peopleCount", { count: memberCount })}
              <span aria-hidden className="rtl:-scale-x-100">
                ›
              </span>
            </span>
          </Link>
          {/* Invitation management is owner-only — the route itself also
              redirects a non-owner, and the RPCs refuse them regardless
              (docs/architecture/04-roles-permission-matrix.md). */}
          {role === "owner" ? (
            <Link
              href="/home/invitations"
              className="flex min-h-14 items-center justify-between px-4 active:bg-surface-2"
            >
              <span className="hl-body text-ink">{t("home.invitations")}</span>
              <span aria-hidden className="rtl:-scale-x-100 text-ink-muted">
                ›
              </span>
            </Link>
          ) : null}
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

      {/* A fixed, un-translated line by design — a copyright notice reads
          the same in every language, the way a URL does. */}
      <p className="hl-caption pb-2 pt-6 text-center text-ink-faint">
        Copyright © reemora.app 2026
      </p>
    </Screen>
  );
}
