"use client";

import Link from "next/link";

import { Card, Screen } from "@/components/ui/Primitives";
import { branding } from "@/lib/branding";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const POINT_KEYS: MessageKey[] = [
  "about.point1",
  "about.point2",
  "about.point3",
  "about.point4",
  "about.point5",
  "about.point6",
];

/** A short, plain-language explainer of what the app actually does —
 * reached from Settings ("About the app"), for whoever needs to be
 * talked through it once rather than figure it out by tapping around. */
export function AboutScreen() {
  const { t } = useLocale();

  return (
    <Screen title={t("about.title", { name: branding.name })}>
      <Card>
        <ul className="space-y-4">
          {POINT_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-3">
              <span aria-hidden className="mt-1 text-primary">
                •
              </span>
              <span className="hl-body text-ink">{t(key, { name: branding.name })}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Link
        href="/home/settings"
        className="hl-label text-center text-primary underline"
      >
        {t("common.back")}
      </Link>
    </Screen>
  );
}
