import "server-only";

import { redirect } from "next/navigation";

import { getServerUserProfile } from "@/lib/auth/session";
import { getHouseholdSubscription, hasAccess } from "@/lib/subscription/queries";
import { getSelectedHouseholdId } from "./currentHousehold";
import type { Membership } from "./queries";
import { getActiveMemberships, getPrimaryMembership } from "./queries";

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

/**
 * Requires a signed-in user who belongs to a household in an owner/member
 * role, and resolves WHICH one: a user can belong to several (My Home, My
 * Office, ...), and the Homes switcher (`app/home/page.tsx`) lets them
 * choose which is "current" via `hl_household` (`currentHousehold.ts`).
 *
 * The cookie is only ever a hint — it is re-checked here against the
 * caller's real active memberships on every call, so a stale value (the
 * household was left, or the cookie is forged) just falls back to the
 * first owner/member membership rather than granting anything. This
 * function is defence in depth, not the authorization boundary; every RPC
 * downstream re-checks `auth.uid()` against `household_members` itself.
 *
 * A user with no owner/member household at all, but at least one worker
 * membership, is sent to that experience instead of the switcher — the
 * switcher has nothing to show them.
 */
export async function requireHouseholdAccess(): Promise<Membership> {
  const profile = await getServerUserProfile();
  if (!profile) redirect("/login");

  const memberships = await getActiveMemberships();
  const homes = memberships.filter((membership) => membership.role !== "worker");

  if (homes.length === 0) {
    if (memberships.length === 0) redirect("/onboarding");
    redirect("/worker");
  }

  const selectedId = await getSelectedHouseholdId();
  return homes.find((home) => home.householdId === selectedId) ?? homes[0];
}

/**
 * Gates the actual shopping-list experience (dashboard, browsing, a
 * list's own checklist) behind the household's subscription — a free
 * trial from creation, then an Apple subscription
 * (20260904160000_household_subscriptions.sql). Called after
 * requireHouseholdAccess() by the pages that do real work, never by
 * Settings or /home/paywall itself: those two must stay reachable
 * however the subscription looks, or a lapsed household would have no
 * way to see its own status or get to "Subscribe".
 */
export async function requireActiveSubscription(membership: Membership): Promise<void> {
  const subscription = await getHouseholdSubscription(membership.householdId);
  if (subscription && hasAccess(subscription)) return;
  redirect("/home/paywall");
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
