"use client";

import Link from "next/link";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { Screen, useRoleLabel } from "@/components/ui/Primitives";
import { selectHouseholdAction } from "@/lib/household/actions";
import type { Membership } from "@/lib/household/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Every household the signed-in user belongs to, as a card — "My home",
 * "My office", however many they run (docs/architecture/08-route-map.md).
 *
 * Each card is its own `<form>` posting to `selectHouseholdAction`, not a
 * `<Link>`: choosing a household is a write (it sets which one is
 * "current" via a cookie), not just navigation, and a form keeps that
 * working with JavaScript disabled.
 */
export function HomesSwitcher({ homes }: { homes: Membership[] }) {
  const { t } = useLocale();
  const roleLabel = useRoleLabel();

  return (
    <Screen title={t("home.myHomes")}>
      <div className="flex items-center justify-center py-4">
        <MachlaLockup size={48} />
      </div>

      <ul className="flex flex-col gap-3">
        {homes.map((home) => (
          <li key={home.householdId}>
            <form action={selectHouseholdAction.bind(null, home.householdId)}>
              <button
                type="submit"
                className="flex min-h-20 w-full items-center gap-4 rounded-lg border border-line bg-surface p-4 text-start shadow-sm transition-colors duration-150 ease-hl active:bg-surface-2"
              >
                <span
                  aria-hidden
                  className="flex size-12 shrink-0 items-center justify-center rounded-pill bg-primary-tint text-2xl leading-none"
                >
                  🏠
                </span>
                <span className="min-w-0 flex-1">
                  <span className="hl-heading block truncate text-ink">
                    {home.householdName}
                  </span>
                  <span className="hl-caption block">
                    {roleLabel(home.role)}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="rtl:-scale-x-100 text-lg leading-none text-ink-muted"
                >
                  ›
                </span>
              </button>
            </form>
          </li>
        ))}
      </ul>

      <Link
        href="/onboarding"
        className="flex min-h-14 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-primary"
      >
        <span aria-hidden className="text-lg leading-none">
          +
        </span>
        <span className="hl-label">{t("home.addHome")}</span>
      </Link>
    </Screen>
  );
}
