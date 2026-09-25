import { notFound } from "next/navigation";

import { CategoryBrowser } from "@/components/worker/CategoryBrowser";
import { getCategories, getCategoryByKey, getProductsInCategoryGrouped } from "@/lib/catalog/queries";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getUnreadCount } from "@/lib/notifications/queries";

/** Products in one category, adding to a received list — mirrors
 * app/worker/c/[key]/page.tsx, but targeting a specific already-sent list
 * (`targetListId`) instead of the caller's own draft. See
 * components/household/AddToListScreen.tsx. */
export default async function AddToListCategoryPage({
  params,
}: {
  params: Promise<{ id: string; key: string }>;
}) {
  const { id, key } = await params;
  const membership = await requireHouseholdAccess();

  const category = await getCategoryByKey(key);
  if (!category) notFound();

  const [groupedProducts, categories, unreadCount] = await Promise.all([
    getProductsInCategoryGrouped(category.id),
    getCategories(),
    getUnreadCount(),
  ]);

  return (
    <CategoryBrowser
      category={category}
      groupedProducts={groupedProducts}
      categories={categories}
      householdId={membership.householdId}
      quantities={{}}
      itemCount={0}
      unreadCount={unreadCount}
      basePath={`/home/lists/${id}/add`}
      targetListId={id}
    />
  );
}
