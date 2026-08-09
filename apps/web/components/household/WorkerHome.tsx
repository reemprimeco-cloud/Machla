"use client";

import { HomeListLockup } from "@/components/brand/HomeListIcon";
import { Card, Screen } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { AccountActions } from "./AccountActions";

export function WorkerHome({ householdName }: { householdName: string }) {
  const { t } = useLocale();

  return (
    <Screen>
      <div className="flex flex-col items-center gap-4 py-4">
        <HomeListLockup size={32} />
      </div>

      <Card>
        <p className="hl-caption">{t("worker.yourHome")}</p>
        <p className="hl-heading mt-1 text-ink">{householdName}</p>
      </Card>

      <Card>
        <p className="hl-label text-ink">{t("worker.waiting")}</p>
      </Card>

      <AccountActions />
    </Screen>
  );
}
