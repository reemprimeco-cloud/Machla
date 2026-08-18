"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { ErrorText, Screen, useRoleLabel } from "@/components/ui/Primitives";
import { selectHouseholdAction } from "@/lib/household/actions";
import type { Membership } from "@/lib/household/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Every household the signed-in user belongs to, as a card — "My home",
 * "My office", however many they run (docs/architecture/08-route-map.md).
 *
 * Tapping one calls `selectHouseholdAction` directly (the same imperative
 * pattern every other action in this app uses — MembersList's remove,
 * SettingsScreen's logout/delete), rather than a plain `<form action>`:
 * that declarative form had no pending state and no error handling, so a
 * slow or failed request looked exactly like a dead tap — a real "app was
 * unresponsive" App Review rejection (Guideline 2.1(a), 2026-08-18). The
 * `disabled` + label swap below is what actually tells the person
 * something is happening during the round trip to set the cookie and
 * redirect to `/home/dashboard`.
 */
export function HomesSwitcher({ homes }: { homes: Membership[] }) {
  const router = useRouter();
  const { t } = useLocale();
  const roleLabel = useRoleLabel();

  const [selectingId, setSelectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(householdId: string) {
    if (selectingId) return;
    setSelectingId(householdId);
    setError(null);
    try {
      await selectHouseholdAction(householdId);
      router.push("/home/dashboard");
      router.refresh();
    } catch {
      setSelectingId(null);
      setError(t("errors.generic"));
    }
  }

  return (
    <Screen title={t("home.myHomes")}>
      <div className="flex items-center justify-center py-4">
        <MachlaLockup size={48} />
      </div>

      <ErrorText>{error}</ErrorText>

      <ul className="flex flex-col gap-3">
        {homes.map((home) => (
          <li key={home.householdId}>
            <button
              type="button"
              onClick={() => handleSelect(home.householdId)}
              disabled={selectingId !== null}
              className="flex min-h-20 w-full items-center gap-4 rounded-lg border border-line bg-surface p-4 text-start shadow-sm transition-colors duration-150 ease-hl active:bg-surface-2 disabled:opacity-60"
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
                  {selectingId === home.householdId
                    ? t("home.selecting")
                    : roleLabel(home.role)}
                </span>
              </span>
              <span
                aria-hidden
                className="rtl:-scale-x-100 text-lg leading-none text-ink-muted"
              >
                ›
              </span>
            </button>
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
