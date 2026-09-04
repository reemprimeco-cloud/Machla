import { WorkerHome } from "@/components/worker/WorkerHome";
import { getCategories } from "@/lib/catalog/queries";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/**
 * The worker's home screen: category tiles and search.
 *
 * Reads the draft but never creates one — the list row is minted on the
 * first add, so merely opening the app leaves no trace
 * (lib/list/queries.ts).
 */
export default async function WorkerPage() {
  const membership = await requireWorkerAccess();

  const [categories, draft, unreadCount] = await Promise.all([
    getCategories(),
    getDraftList(membership.householdId),
    getUnreadCount(),
  ]);

  return (
    <WorkerHome
      householdName={membership.householdName}
      categories={categories}
      itemCount={draft?.itemCount ?? 0}
      unreadCount={unreadCount}
    />
  );
}
