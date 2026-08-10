import { PhotoCapture } from "@/components/worker/PhotoCapture";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList } from "@/lib/list/queries";

/**
 * Photograph something the catalogue does not have.
 *
 * Reached from the capture tile in the browse grid. The draft is read,
 * not created — same rule as every other worker screen: opening a screen
 * must not mint a list row (`lib/list/queries.ts`).
 */
export default async function PhotoPage() {
  const membership = await requireWorkerAccess();
  const draft = await getDraftList(membership.householdId);

  return <PhotoCapture householdId={membership.householdId} listId={draft?.list.id ?? null} />;
}
