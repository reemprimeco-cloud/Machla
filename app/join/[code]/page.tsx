import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { JoinFlow } from "@/components/household/JoinFlow";
import { getServerUserProfile } from "@/lib/auth/session";
import { isSupportedLocale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";

/**
 * Deep-link entry point (homelist.app/join/K7P4M2). An unauthenticated
 * visitor is sent to sign in first and can return to this same URL —
 * the code is in the path, so nothing is lost.
 *
 * Checks the locale cookie first, same as the root gate (app/page.tsx) —
 * this is the realistic first-touch path for a worker tapping a shared
 * WhatsApp invite link cold, and without this check she signed up and
 * joined the household entirely in English (DEFAULT_LOCALE), never
 * seeing the language picker at all until after the fact (2026-10-21
 * critique finding).
 */
export default async function JoinWithCodePage({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const destination = `/join/${code}`;

  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  if (!rawLocale || !isSupportedLocale(rawLocale)) {
    redirect(`/welcome?next=${encodeURIComponent(destination)}`);
  }

  const profile = await getServerUserProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(destination)}`);

  return <JoinFlow initialCode={code} defaultDisplayName={profile.display_name ?? ""} />;
}
