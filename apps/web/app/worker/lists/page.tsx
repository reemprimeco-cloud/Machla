import { WorkerHistory } from "@/components/worker/WorkerHistory";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getHouseholdLists } from "@/lib/list/household";

/**
 * The worker's own sent-list history (Amendment 1 §16A.10).
 *
 * Reuses `get_household_lists`, which returns only the caller's own lists
 * to a Worker — the same rule the RLS policy applies, enforced inside the
 * SECURITY DEFINER function so it cannot be used to step around them.
 */
export default async function WorkerListsPage() {
  const membership = await requireWorkerAccess();
  const lists = await getHouseholdLists(membership.householdId);

  return <WorkerHistory lists={lists} />;
}
