import type { Metadata } from "next";

import { PrivacyScreen } from "@/components/legal/PrivacyScreen";
import { branding } from "@/lib/branding";

/**
 * Public — deliberately outside `/home` and `/worker`, so it carries none
 * of their auth guards. This is the URL that goes in App Store Connect's
 * privacy-policy field, and a reviewer with no Machla account has to be
 * able to open it.
 *
 * Still excluded from search indexing by app/robots.ts, same as every
 * other route: a working link is all App Store submission needs, not
 * discoverability.
 */
export const metadata: Metadata = {
  title: `${branding.name} — Privacy Policy`,
};

export default function PublicPrivacyPage() {
  return <PrivacyScreen backHref="/" />;
}
