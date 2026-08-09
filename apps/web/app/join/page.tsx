import { redirect } from "next/navigation";

import { JoinFlow } from "@/components/household/JoinFlow";
import { getServerUserProfile } from "@/lib/auth/session";

/** Manual invitation-code entry. The deep-link equivalent is
 * /join/[code] — master plan §13 keeps both. */
export default async function JoinPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  return <JoinFlow defaultDisplayName={profile.display_name ?? ""} />;
}
