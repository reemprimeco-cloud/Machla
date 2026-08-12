import { WorkerHome } from "@/components/worker/WorkerHome";
import { getCategories, getFrequentProducts } from "@/lib/catalog/queries";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/**
 * The owner/member's own shopping list — the exact mechanism the helper
 * uses (`app/worker/page.tsx`), reused rather than rebuilt: `set_list_item`
 * and friends already authorize any active member of the household, not
 * only a worker (20260809170000_phase6_worker_lists.sql's own comment says
 * so), and a sent list here shows up in `/home/lists` exactly like one
 * from a helper — `get_household_lists` never filtered by who sent it.
 * `basePath="/home/shop"` is the only thing that differs from the worker
 * screens; see the comment on `WorkerHome`'s prop for what it changes.
 */
export default async function ShopPage() {
  const membership = await requireHouseholdAccess();

  const [categories, frequent, draft, unreadCount] = await Promise.all([
    getCategories(),
    getFrequentProducts(6),
    getDraftList(membership.householdId),
    getUnreadCount(),
  ]);

  return (
    <WorkerHome
      householdId={membership.householdId}
      householdName={membership.householdName}
      categories={categories}
      frequent={frequent}
      quantities={quantitiesByProduct(draft)}
      itemCount={draft?.itemCount ?? 0}
      unreadCount={unreadCount}
      basePath="/home/shop"
    />
  );
}
