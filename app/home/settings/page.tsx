import { redirect } from "next/navigation";

import { SettingsScreen } from "@/components/household/SettingsScreen";
import { getServerUserProfile } from "@/lib/auth/session";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";
import { computeTrialState, getHouseholdSubscription, hasAccess } from "@/lib/subscription/queries";

/**
 * Account-level settings (who you are, language, sign out) plus the
 * CURRENT household's People/Invitations — moved here from the
 * dashboard so it isn't competing for space with "my own list" and
 * "your lists" (2026-08 feedback). `requireHouseholdAccess()` is cheap
 * to call again here: app/home/layout.tsx already called it this same
 * request, and its own reads are React `cache()`'d.
 */
export default async function SettingsPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const membership = await requireHouseholdAccess();
  const [members, subscription] = await Promise.all([
    getHouseholdMembers(membership.householdId),
    getHouseholdSubscription(membership.householdId),
  ]);

  const trial = subscription ? computeTrialState(subscription) : { active: false, daysLeft: 0 };

  return (
    <SettingsScreen
      phoneNumber={profile.phone_number}
      displayName={profile.display_name}
      role={membership.role}
      memberCount={members.length}
      subscriptionStatus={subscription?.status ?? null}
      subscriptionHasAccess={subscription ? hasAccess(subscription) : false}
      trialActive={trial.active}
      trialDaysLeft={trial.daysLeft}
    />
  );
}
