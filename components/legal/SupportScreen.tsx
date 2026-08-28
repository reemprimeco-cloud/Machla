"use client";

import Link from "next/link";

import { Card, Screen } from "@/components/ui/Primitives";
import { branding } from "@/lib/branding";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * A PUBLIC page, same reasoning as PrivacyScreen: App Store Connect's
 * Support URL field must be a real http(s) link a reviewer can open
 * without an account — a mailto: link isn't accepted there, and the
 * Privacy Policy page isn't the right destination for a general support
 * question (Apple flagged exactly that mismatch once already).
 *
 * Reached two ways, same pattern as /privacy: from Settings (signed in)
 * and directly at /support (signed out). Both render this component;
 * only backHref differs.
 */
export function SupportScreen({ backHref }: { backHref: string }) {
  const { t } = useLocale();

  return (
    <Screen title={t("support.title")}>
      <Card>
        <p className="hl-body text-ink">{t("support.body", { name: branding.name })}</p>
        <a
          href={`mailto:${branding.supportEmail}`}
          className="hl-label mt-4 block text-primary underline underline-offset-4"
        >
          <bdi dir="ltr">{branding.supportEmail}</bdi>
        </a>
      </Card>

      <Link href={backHref} className="hl-label text-center text-primary underline">
        {t("common.back")}
      </Link>
    </Screen>
  );
}
