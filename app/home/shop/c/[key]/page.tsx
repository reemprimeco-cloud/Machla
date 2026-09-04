import { notFound } from "next/navigation";

import { CategoryBrowser } from "@/components/worker/CategoryBrowser";
import { getCategories, getCategoryByKey, getProductsInCategory } from "@/lib/catalog/queries";
import { requireActiveSubscription, requireHouseholdAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/** Mirrors app/worker/c/[key]/page.tsx — see app/home/shop/page.tsx for
 * why this is a thin `basePath` variant rather than a separate build. */
export default async function ShopCategoryPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const membership = await requireHouseholdAccess();
  await requireActiveSubscription(membership);

  const category = await getCategoryByKey(key);
  if (!category) notFound();

  const [products, categories, draft, unreadCount] = await Promise.all([
    getProductsInCategory(category.id),
    getCategories(),
    getDraftList(membership.householdId),
    getUnreadCount(),
  ]);

  return (
    <CategoryBrowser
      category={category}
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
