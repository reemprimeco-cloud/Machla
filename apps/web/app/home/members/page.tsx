import { MembersList } from "@/components/household/MembersList";
import { getServerUserProfile } from "@/lib/auth/session";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getHouseholdMembers } from "@/lib/household/queries";

export default async function MembersPage() {
  const membership = await requireHouseholdAccess();
  const [members, profile] = await Promise.all([
    getHouseholdMembers(membership.householdId),
    getServerUserProfile(),
  ]);

  return (
    <MembersList
      householdId={membership.householdId}
      members={members}
      currentUserId={profile?.id ?? ""}
      canRemove={membership.role === "owner"}
    />
  );
}
