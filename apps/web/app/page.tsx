import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getServerUserProfile } from "@/lib/auth/session";
import { getPrimaryMembership } from "@/lib/household/queries";
import { isSupportedLocale } from "@/lib/i18n/config";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/cookie";

/**
 * Root route — pure routing, no UI of its own. Gates in order
 * (docs/architecture/08-route-map.md §1):
 *
 *   1. locale chosen?   no -> /welcome           (Phase 2)
 *   2. signed in?       no -> /login             (Phase 3)
 *   3. in a household?  no -> /onboarding        (Phase 4)
 *   4. which role?      worker -> /worker, owner|member -> /home
 *
 * Each destination re-checks its own preconditions, so landing on one
 * directly is equally safe — this is a convenience layer, not the
 * security boundary (that is RLS plus the RPCs' own checks).
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;

  if (!rawLocale || !isSupportedLocale(rawLocale)) {
    redirect("/welcome");
  }

  const profile = await getServerUserProfile();
  if (!profile) {
    redirect("/login");
  }

  const membership = await getPrimaryMembership();
  if (!membership) {
    redirect("/onboarding");
  }

  redirect(membership.role === "worker" ? "/worker" : "/home");
}
