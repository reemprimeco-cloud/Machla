import "server-only";

import { redirect } from "next/navigation";

import { getServerUserProfile } from "@/lib/auth/session";
import type { Membership } from "./queries";
import { getPrimaryMembership } from "./queries";

/**
 * Server-side route guards for the household experience.
 *
 * These are defense-in-depth, not the primary control: every query and
 * mutation they protect is *also* enforced by RLS or by an RPC's own
 * authorization check, so a request that skipped the route layer
 * entirely still gets refused by Postgres
 * (docs/architecture/08-route-map.md §3, 10-security-model.md §1).
 * Their real job is sending people somewhere sensible rather than
 * showing them an empty or broken page.
 */

/** Requires a signed-in user who belongs to a household, in an
 * owner/member role. Workers are sent to their own experience. */
export async function requireHouseholdAccess(): Promise<Membership> {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const membership = await getPrimaryMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role === "worker") redirect("/worker");

  return membership;
}

/** Requires the owner specifically — the household-management actions
 * (invite, remove) that 04-roles-permission-matrix.md reserves for them. */
export async function requireOwner(): Promise<Membership> {
  const membership = await requireHouseholdAccess();
  if (membership.role !== "owner") redirect("/home");
  return membership;
}

/** Requires a signed-in worker with a household. Owners/members are sent
 * to the household experience. */
export async function requireWorkerAccess(): Promise<Membership> {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const membership = await getPrimaryMembership();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "worker") redirect("/home");

  return membership;
}
