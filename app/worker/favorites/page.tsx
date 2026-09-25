import { FavoritesScreen } from "@/components/worker/FavoritesScreen";
import { getCategories } from "@/lib/catalog/queries";
import { getFavoriteProducts } from "@/lib/favorites/queries";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/** The worker's own favorites — see app/home/shop/favorites/page.tsx
 * for the owner/member mirror. */
export default async function WorkerFavoritesPage() {
  const membership = await requireWorkerAccess();

  const [products, categories, draft, unreadCount] = await Promise.all([
    getFavoriteProducts(),
    getCategories(),
    getDraftList(membership.householdId),
    getUnreadCount(),
  ]);

  return (
    <FavoritesScreen
      products={products}
      categories={categories}
      householdId={membership.householdId}
      quantities={quantitiesByProduct(draft)}
      itemCount={draft?.itemCount ?? 0}
      unreadCount={unreadCount}
    />
  );
}
