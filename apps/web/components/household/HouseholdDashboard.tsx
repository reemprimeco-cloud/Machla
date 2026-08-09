"use client";

import Link from "next/link";

import { HomeListLockup } from "@/components/brand/HomeListIcon";
import { Card, Screen } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { HouseholdRole } from "@/lib/supabase/database.types";

import { AccountActions } from "./AccountActions";

export function HouseholdDashboard({
  householdName,
  role,
  memberCount,
}: {
  householdName: string;
  role: HouseholdRole;
  memberCount: number;
}) {
  const { t } = useLocale();

  return (
    <Screen>
      <div className="flex flex-col items-center gap-4 py-4">
        <HomeListLockup size={32} />
        <h1 className="hl-title text-ink">{householdName}</h1>
      </div>

      <Card>
        <p className="hl-label text-ink">{t("common.comingSoon")}</p>
      </Card>

      <nav className="flex flex-col gap-3">
        <Link
          href="/home/members"
          className="flex min-h-14 items-center justify-between rounded-lg border border-sand bg-surface px-5 shadow-sm active:bg-surface-2"
        >
          <span className="hl-heading text-ink">{t("home.people")}</span>
          <span className="hl-caption">{t("home.peopleCount", { count: memberCount })}</span>
        </Link>

        {/* Invitation management is owner-only — the route itself also
            redirects a non-owner, and the RPCs refuse them regardless
            (docs/architecture/04-roles-permission-matrix.md). */}
        {role === "owner" ? (
          <Link
            href="/home/invitations"
            className="flex min-h-14 items-center rounded-lg border border-sand bg-surface px-5 shadow-sm active:bg-surface-2"
          >
            <span className="hl-heading text-ink">{t("home.invitations")}</span>
          </Link>
        ) : null}
      </nav>

      <AccountActions />
    </Screen>
  );
}
