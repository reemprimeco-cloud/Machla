import { InvitationsManager } from "@/components/household/InvitationsManager";
import { requireOwner } from "@/lib/household/guard";
import { getPendingInvitations } from "@/lib/household/queries";

/** Owner-only (docs/architecture/04-roles-permission-matrix.md). The
 * guard redirects a non-owner, RLS hides the rows, and the RPCs refuse
 * the mutations — three independent layers, not one. */
export default async function InvitationsPage() {
  const membership = await requireOwner();
  const invitations = await getPendingInvitations(membership.householdId);

  return (
    <InvitationsManager householdId={membership.householdId} invitations={invitations} />
  );
}
