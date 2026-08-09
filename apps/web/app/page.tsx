import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { HomeShell } from "@/components/HomeShell";
import { isSupportedLocale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";

// Root route. Once Phase 3 (auth) exists this becomes a full auth +
// household-membership redirect (docs/architecture/08-route-map.md).
// For now it only gates on whether a locale has been chosen yet: no
// cookie -> send the visitor to the language picker; cookie present ->
// render the (now-localized) placeholder shell. This also doubles as the
// "locale survives reload" behavior: reloading "/" after choosing a
// language never bounces back to /welcome.
export default async function HomePage() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (!rawLocale || !isSupportedLocale(rawLocale)) {
    redirect("/welcome");
  }

  return <HomeShell />;
}
