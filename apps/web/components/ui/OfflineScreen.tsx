"use client";

import { HomeLink, MessageScreen } from "@/components/ui/States";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export function OfflineScreen() {
  const { t } = useLocale();

  return (
    <MessageScreen
      glyph="📡"
      title={t("state.offlineTitle")}
      // "Your list is safe" is the sentence that matters: the worker's
      // draft lives in Postgres, not in local state, so losing signal
      // mid-shop costs nothing. Saying so stops them re-adding everything.
      hint={t("state.offlineHint")}
      action={<HomeLink />}
    />
  );
}
