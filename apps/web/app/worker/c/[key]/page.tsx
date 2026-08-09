import { notFound } from "next/navigation";

import { CategoryBrowser } from "@/components/worker/CategoryBrowser";
import { getCategories, getCategoryByKey, getProductsInCategory } from "@/lib/catalog/queries";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";

/** Products in one category. Addressed by the category's stable `key`
 * rather than its uuid, so the URL survives a catalogue re-import. */
export default async function CategoryPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const membership = await requireWorkerAccess();

  const category = await getCategoryByKey(key);
  if (!category) notFound();

  const [products, categories, draft] = await Promise.all([
    getProductsInCategory(category.id),
    getCategories(),
    getDraftList(membership.householdId),
  ]);

  return (
    <CategoryBrowser
      category={category}
      products={products}
      categories={categories}
      householdId={membership.householdId}
      quantities={quantitiesByProduct(draft)}
      itemCount={draft?.itemCount ?? 0}
    />
  );
}
