import { WorkerHome } from "@/components/household/WorkerHome";
import { requireWorkerAccess } from "@/lib/household/guard";

/**
 * Worker experience. Phase 6 replaces this with the visual category and
 * product browser; Phase 4 only needs to confirm the worker is connected
 * to the right household.
 */
export default async function WorkerPage() {
  const membership = await requireWorkerAccess();
  return <WorkerHome householdName={membership.householdName} />;
}
