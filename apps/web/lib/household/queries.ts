import "server-only";

import { cache } from "react";

import { getServerUserProfile } from "@/lib/auth/session";
import type { Database, HouseholdRole } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

export interface Membership {
  householdId: string;
  householdName: string;
  role: HouseholdRole;
}

export type HouseholdMember =
  Database["public"]["Functions"]["get_household_members"]["Returns"][number];

export type Invitation = Pick<
  Database["public"]["Tables"]["household_invitations"]["Row"],
  "id" | "code" | "role" | "expires_at" | "created_at"
>;

/**
 * Every household the signed-in user is an *active* member of, with the
 * role they hold there.
 *
 * Deliberately two plain selects rather than a join: RLS already scopes
 * `households` to the caller's own households and `household_members` to
 * rows they may see, so zipping in JS gives the same result without
 * depending on the FK metadata that a hand-authored Database type
 * doesn't carry (lib/supabase/database.types.ts).
 *
 * cache()'d because the root route, the layout, and individual pages all
 * need it within one request.
 */
export const getActiveMemberships = cache(async (): Promise<Membership[]> => {
  if (!isSupabaseConfigured()) return [];

  const profile = await getServerUserProfile();
  if (!profile) return [];

  const supabase = await createClient();

  const [{ data: memberships }, { data: households }] = await Promise.all([
    supabase
      .from("household_members")
      .select("household_id, role")
      .eq("user_id", profile.id)
      .eq("status", "active"),
    supabase.from("households").select("id, name"),
  ]);

  if (!memberships || !households) return [];

  const nameById = new Map(households.map((household) => [household.id, household.name]));

  return memberships
    .filter((membership) => nameById.has(membership.household_id))
    .map((membership) => ({
      householdId: membership.household_id,
      householdName: nameById.get(membership.household_id)!,
      role: membership.role,
    }));
});

/**
 * The membership the app should route into. V1 does not build a
 * household switcher (docs/architecture/14-technical-risks-decisions.md
 * item 5), so when a user somehow belongs to more than one household the
 * first is used — the schema permits several, the UI just doesn't
 * surface the choice yet.
 */
export const getPrimaryMembership = cache(async (): Promise<Membership | null> => {
  const memberships = await getActiveMemberships();
  return memberships[0] ?? null;
});

/** Roster for a household. Owner/Member only — the RPC itself rejects a
 * Worker caller, so this is not merely a UI-level restriction. */
export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_household_members", {
    p_household_id: householdId,
  });

  if (error) return [];
  return data ?? [];
}

/** Pending invitations for a household. `household_invitations` is
 * owner-only at the RLS layer, so a non-owner simply gets an empty list
 * rather than a leak. */
export async function getPendingInvitations(householdId: string): Promise<Invitation[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("household_invitations")
    .select("id, code, role, expires_at, created_at")
    .eq("household_id", householdId)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}
