import { notFound } from "next/navigation";

import { CategoryBrowser } from "@/components/worker/CategoryBrowser";
import { getCategories, getCategoryByKey, getProductsInCategoryGrouped } from "@/lib/catalog/queries";
import { getFavoriteProductIds } from "@/lib/favorites/queries";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/** Products in one category. Addressed by the category's stable `key`
 * rather than its uuid, so the URL survives a catalogue re-import. */
export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<{ listId?: string }>;
}) {
  const { key } = await params;
  const { listId } = await searchParams;
  const membership = await requireWorkerAccess();

  const category = await getCategoryByKey(key);
  if (!category) notFound();

  const [groupedProducts, categories, draft, unreadCount, favoriteProductIds] = await Promise.all([
    getProductsInCategoryGrouped(category.id),
    getCategories(),
    getDraftList(membership.householdId),
    getUnreadCount(),
    getFavoriteProductIds(),
  ]);

  return (
    <CategoryBrowser
      category={category}
      groupedProducts={groupedProducts}
      categories={categories}
      householdId={membership.householdId}
      quantities={quantitiesByProduct(draft)}
      itemCount={draft?.itemCount ?? 0}
      unreadCount={unreadCount}
      targetListId={listId}
      favoriteProductIds={favoriteProductIds}
    />
  );
}
