"use client";

import { MachlaLockup } from "@/components/brand/MachlaIcon";
import { ChoiceCard, Screen } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function OnboardingChoices() {
  const { t } = useLocale();

  return (
    <Screen>
      <div className="flex flex-col items-center gap-6 py-6">
        <MachlaLockup size={36} />
        <h1 className="hl-title text-ink">{t("onboarding.title")}</h1>
      </div>

      <div className="flex flex-col gap-3">
        <ChoiceCard
          href="/join"
          title={t("onboarding.joinHome")}
          hint={t("onboarding.joinHomeHint")}
        />
        <ChoiceCard
          href="/household/new"
          title={t("onboarding.createHome")}
          hint={t("onboarding.createHomeHint")}
        />
      </div>
    </Screen>
  );
}
