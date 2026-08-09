import { redirect } from "next/navigation";

import { CreateHouseholdForm } from "@/components/household/CreateHouseholdForm";
import { getServerUserProfile } from "@/lib/auth/session";
import { getPrimaryMembership } from "@/lib/household/queries";

export default async function NewHouseholdPage() {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const membership = await getPrimaryMembership();
  if (membership) redirect("/");

  return <CreateHouseholdForm defaultDisplayName={profile.display_name ?? ""} />;
}
