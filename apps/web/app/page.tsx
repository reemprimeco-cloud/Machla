import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { HomeShell } from "@/components/HomeShell";
import { getServerUserProfile } from "@/lib/auth/session";
import { isSupportedLocale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";

// Root route. Once Phase 4 (households) exists this becomes a full
// household-membership redirect (docs/architecture/08-route-map.md).
// For now it gates on two things in order:
//   1. Locale chosen yet? No cookie -> /welcome (Phase 2 behavior,
//      unchanged — this also doubles as "locale survives reload":
//      reloading "/" after choosing a language never bounces back).
//   2. Signed in? No session -> /login (Phase 3). Signed in -> render
//      the (still placeholder) authenticated shell.
export default async function HomePage() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (!rawLocale || !isSupportedLocale(rawLocale)) {
    redirect("/welcome");
  }

  const profile = await getServerUserProfile();
  if (!profile) {
    redirect("/login");
  }

  return <HomeShell phoneNumber={profile.phone_number} />;
}
