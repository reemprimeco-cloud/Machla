import { redirect } from "next/navigation";

import { OnboardingChoices } from "@/components/household/OnboardingChoices";
import { getServerUserProfile } from "@/lib/auth/session";

/**
 * The fork in the road: join a household with an invitation code, or
 * create one and become its owner.
 *
 * Reachable two ways — a brand-new signed-in user with no household at
 * all (routed here by `/`, docs/architecture/08-route-map.md), and an
 * existing owner/member adding another one from the Homes switcher's
 * "+ Add another home" (`components/household/HomesSwitcher.tsx`). Both
 * are the same fork, so this page no longer redirects away just because
 * the caller already belongs to a household — only signed-out visitors
 * are turned back.
 */
export default async function OnboardingPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  return <OnboardingChoices />;
}
