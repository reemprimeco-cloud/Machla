import { redirect } from "next/navigation";

import { SettingsScreen } from "@/components/household/SettingsScreen";
import { getServerUserProfile } from "@/lib/auth/session";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";

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
  const members = await getHouseholdMembers(membership.householdId);

  return (
    <SettingsScreen
      phoneNumber={profile.phone_number}
      displayName={profile.display_name}
      role={membership.role}
      memberCount={members.length}
    />
  );
}
