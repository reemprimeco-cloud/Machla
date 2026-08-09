import { redirect } from "next/navigation";

import { OnboardingChoices } from "@/components/household/OnboardingChoices";
import { getServerUserProfile } from "@/lib/auth/session";
import { getPrimaryMembership } from "@/lib/household/queries";

/**
 * The fork in the road for a signed-in user with no household yet
 * (docs/architecture/08-route-map.md): join one with an invitation code,
 * or create one and become its owner.
 */
export default async function OnboardingPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  // Already in a household — nothing to onboard.
  const membership = await getPrimaryMembership();
  if (membership) redirect("/");

  return <OnboardingChoices />;
}
