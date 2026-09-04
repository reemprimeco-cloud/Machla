import { ListReview } from "@/components/worker/ListReview";
import { requireActiveSubscription, requireHouseholdAccess } from "@/lib/household/guard";
import { getDraftList } from "@/lib/list/queries";

/** Mirrors app/worker/list/page.tsx — see app/home/shop/page.tsx for why
 * this is a thin `basePath` variant rather than a separate build. */
export default async function ShopListPage() {
  const membership = await requireHouseholdAccess();
  await requireActiveSubscription(membership);
  const draft = await getDraftList(membership.householdId);

  return (
    <ListReview
      householdId={membership.householdId}
      listId={draft?.list.id ?? null}
      groups={draft?.groups ?? []}
      itemCount={draft?.itemCount ?? 0}
      basePath="/home/shop"
    />
  );
}
