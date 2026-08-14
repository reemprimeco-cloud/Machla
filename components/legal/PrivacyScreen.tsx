"use client";

import Link from "next/link";

import { Card, Screen } from "@/components/ui/Primitives";
import { branding } from "@/lib/branding";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

/** One heading + body pair, in the order the policy reads. */
const SECTIONS: { title: MessageKey; body: MessageKey }[] = [
  { title: "privacy.collectTitle", body: "privacy.collectBody" },
  { title: "privacy.whyTitle", body: "privacy.whyBody" },
  { title: "privacy.seeTitle", body: "privacy.seeBody" },
  { title: "privacy.photosTitle", body: "privacy.photosBody" },
  { title: "privacy.finishedTitle", body: "privacy.finishedBody" },
  { title: "privacy.whereTitle", body: "privacy.whereBody" },
  { title: "privacy.cookiesTitle", body: "privacy.cookiesBody" },
  { title: "privacy.controlTitle", body: "privacy.controlBody" },
  { title: "privacy.childrenTitle", body: "privacy.childrenBody" },
  { title: "privacy.changesTitle", body: "privacy.changesBody" },
];

/**
 * The privacy policy — a PUBLIC page, unlike every other screen in this
 * app. Two things require that:
 *
 *   1. App Store Connect's submission form asks for a privacy-policy URL
 *      and a reviewer has to be able to open it without an account.
 *   2. It's the honest answer to "what happens to my data" for someone
 *      who isn't signed in yet and is deciding whether to be.
 *
 * Reached two ways: from Settings (`/home/settings`, signed in) and
 * directly at `/privacy` (signed out — App Store Connect, or anyone).
 * Both render this same component; only the destination of "back"
 * changes, via the `backHref` prop the two routes each supply.
 *
 * Content lives in locales/*.json under `privacy.*`, in all twelve
 * languages this app ships with — the workers this data is mostly about
 * are exactly the people an English-only policy would fail to inform.
 */
export function PrivacyScreen({ backHref }: { backHref: string }) {
  const { t } = useLocale();

  return (
    <Screen title={t("privacy.title", { name: branding.name })}>
      <p className="hl-caption">{t("privacy.updated")}</p>

      <Card>
        <p className="hl-body text-ink">{t("privacy.intro", { name: branding.name })}</p>
      </Card>

      {SECTIONS.map((section) => (
        <Card key={section.title}>
          <h2 className="hl-heading text-ink">{t(section.title)}</h2>
          <p className="hl-body mt-2 text-ink">{t(section.body, { name: branding.name })}</p>
        </Card>
      ))}

      <Card>
        <h2 className="hl-heading text-ink">{t("privacy.contactTitle")}</h2>
        <p className="hl-body mt-2 text-ink">{t("privacy.contactBody")}</p>
      </Card>

      <Link href={backHref} className="hl-label text-center text-primary underline">
        {t("common.back")}
      </Link>
    </Screen>
  );
}
