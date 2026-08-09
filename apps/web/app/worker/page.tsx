import { WorkerHome } from "@/components/worker/WorkerHome";
import { getCategories, getFrequentProducts } from "@/lib/catalog/queries";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";

/**
 * The worker's home screen: category tiles, search, and whatever they buy
 * most often.
 *
 * Reads the draft but never creates one — the list row is minted on the
 * first add, so merely opening the app leaves no trace
 * (lib/list/queries.ts).
 */
export default async function WorkerPage() {
  const membership = await requireWorkerAccess();

  const [categories, frequent, draft] = await Promise.all([
    getCategories(),
    getFrequentProducts(6),
    getDraftList(membership.householdId),
  ]);

  return (
    <WorkerHome
      householdId={membership.householdId}
      householdName={membership.householdName}
      categories={categories}
      frequent={frequent}
      quantities={quantitiesByProduct(draft)}
      itemCount={draft?.itemCount ?? 0}
    />
  );
}
