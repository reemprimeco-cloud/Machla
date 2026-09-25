import { FavoritesScreen } from "@/components/worker/FavoritesScreen";
import { getCategories } from "@/lib/catalog/queries";
import { getFavoriteProducts } from "@/lib/favorites/queries";
import { requireActiveSubscription, requireHouseholdAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/** Mirrors app/worker/favorites/page.tsx — see app/home/shop/page.tsx
 * for why this is a thin `basePath` variant rather than a separate
 * build. */
export default async function ShopFavoritesPage() {
  const membership = await requireHouseholdAccess();
  await requireActiveSubscription(membership);

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
      basePath="/home/shop"
    />
  );
}
