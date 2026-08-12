import { ListReview } from "@/components/worker/ListReview";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList } from "@/lib/list/queries";

/** Review and send. The list is shown grouped by category, in aisle
 * order, exactly as the owner will receive it — never flattened or
 * re-sorted (Amendment 1 §16A.1). */
export default async function ListPage() {
  const membership = await requireWorkerAccess();
  const draft = await getDraftList(membership.householdId);

  return (
    <ListReview
      householdId={membership.householdId}
      listId={draft?.list.id ?? null}
      groups={draft?.groups ?? []}
      itemCount={draft?.itemCount ?? 0}
    />
  );
}
