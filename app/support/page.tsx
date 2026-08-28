import type { Metadata } from "next";

import { SupportScreen } from "@/components/legal/SupportScreen";
import { branding } from "@/lib/branding";

/**
 * Public — see app/privacy/page.tsx for why. This is the URL that goes
 * in App Store Connect's Support URL field, which rejects a mailto:
 * link and requires an http(s) page a signed-out reviewer can open.
 */
export const metadata: Metadata = {
  title: `${branding.name} — Support`,
};

export default function PublicSupportPage() {
  return <SupportScreen backHref="/" />;
}
