import { PaywallScreen } from "@/components/household/PaywallScreen";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { computeTrialState, getHouseholdSubscription, hasAccess } from "@/lib/subscription/queries";

/**
 * Reachable however the household's subscription looks — this is the
 * ONE screen `requireActiveSubscription` (lib/household/guard.ts) sends
 * a lapsed household to, so it must never itself require an active
 * subscription or nobody could ever get here to fix that.
 *
 * A household that already has access lands here anyway if it navigates
 * here directly (an old bookmark, a stale tab); rendering the "you're
 * all set" state rather than bouncing it back to the dashboard keeps
 * this page simple — it is not a route anything links to under normal
 * use.
 */
export default async function PaywallPage() {
  const membership = await requireHouseholdAccess();
  const subscription = await getHouseholdSubscription(membership.householdId);
  const alreadyHasAccess = subscription ? hasAccess(subscription) : false;
  const trial = subscription ? computeTrialState(subscription) : { active: false, daysLeft: 0 };

  return (
    <PaywallScreen
      householdId={membership.householdId}
      subscriptionStatus={subscription?.status ?? null}
      trialActive={trial.active}
      trialDaysLeft={trial.daysLeft}
      alreadyHasAccess={alreadyHasAccess}
    />
  );
}
