import "server-only";

import { cache } from "react";

import type { SubscriptionStatus } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/isConfigured";
import { createClient } from "@/lib/supabase/server";

import { fetchAppleSubscriptionState } from "./apple";

export interface HouseholdSubscription {
  trialEndsAt: string;
  status: SubscriptionStatus;
  periodEnd: string | null;
  appleOriginalTransactionId: string | null;
}

/**
 * Whether a household currently has paid access — an active or
 * grace-period Apple subscription, or (before any purchase at all)
 * still inside its free trial window. Mirrors
 * `household_has_access(uuid)` in
 * 20260904160000_household_subscriptions.sql exactly, so the SQL
 * function and this client-side copy can never quietly disagree about
 * what "has access" means; this copy exists only so the paywall and
 * Settings screens can render the same answer without a second RPC
 * round trip when they already have the row in hand.
 */
export function hasAccess(subscription: HouseholdSubscription, now = new Date()): boolean {
  if (subscription.status === "active" || subscription.status === "grace_period") return true;
  if (subscription.status === "none" && now < new Date(subscription.trialEndsAt)) return true;
  return false;
}

/**
 * Whether the trial is still running, and how many days are left in it —
 * a plain helper rather than inline arithmetic in PaywallScreen's own
 * render body, since the paywall page (a Server Component) counts as
 * "render" to React's purity check same as any client one, and
 * Date.now()/new Date() are impure calls it flags there but not inside
 * an ordinary function like this one.
 */
export function computeTrialState(
  subscription: HouseholdSubscription,
  now = new Date(),
): { active: boolean; daysLeft: number } {
  const trialEndsAt = new Date(subscription.trialEndsAt);
  return {
    active: subscription.status === "none" && now < trialEndsAt,
    daysLeft: Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000)),
  };
}

/**
 * The household's subscription state, re-confirmed with Apple first if
 * the cached paid period has already ended — the app has no App Store
 * Server Notifications webhook (lib/subscription/apple.ts explains why),
 * so a renewal or cancellation that happened while nobody had the app
 * open would otherwise sit stale until this catches it. Cheap the rest
 * of the time: at most one extra network call, made once per household
 * per lapsed period, never on an ordinary page load.
 *
 * `cache()`'d so a page and the layout that gates it share one lookup
 * per request rather than racing two.
 */
export const getHouseholdSubscription = cache(
  async (householdId: string): Promise<HouseholdSubscription | null> => {
    if (!isSupabaseConfigured()) return null;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("households")
      .select(
        "trial_ends_at, subscription_status, subscription_period_end, apple_original_transaction_id",
      )
      .eq("id", householdId)
      .maybeSingle();

    if (error || !data) return null;

    const subscription: HouseholdSubscription = {
      trialEndsAt: data.trial_ends_at,
      status: data.subscription_status,
      periodEnd: data.subscription_period_end,
      appleOriginalTransactionId: data.apple_original_transaction_id,
    };

    const paidPeriodLapsed =
      (subscription.status === "active" || subscription.status === "grace_period") &&
      subscription.periodEnd !== null &&
      new Date(subscription.periodEnd) <= new Date();

    if (!paidPeriodLapsed || !subscription.appleOriginalTransactionId) return subscription;

    const fresh = await fetchAppleSubscriptionState(subscription.appleOriginalTransactionId);
    if (!fresh) return subscription;

    await supabase.rpc("link_apple_subscription", {
      p_household_id: householdId,
      p_original_transaction_id: fresh.originalTransactionId,
      p_status: fresh.status,
      p_period_end: fresh.periodEnd,
    });

    return { ...subscription, status: fresh.status, periodEnd: fresh.periodEnd };
  },
);
