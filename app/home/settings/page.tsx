import { redirect } from "next/navigation";

import { SettingsScreen } from "@/components/household/SettingsScreen";
import { getServerUserProfile } from "@/lib/auth/session";

/** Account-level settings: who you are, what language you see the app
 * in, and signing out. Deliberately NOT where a household's people or
 * invitations live — those stay per-household under that household's own
 * dashboard, since "people" only means something in the context of one
 * specific home or office. */
export default async function SettingsPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  return <SettingsScreen phoneNumber={profile.phone_number} displayName={profile.display_name} />;
}
