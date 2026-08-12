import { SearchResults } from "@/components/worker/SearchResults";
import { getCategories, searchProducts } from "@/lib/catalog/queries";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/** Mirrors app/worker/search/page.tsx — see app/home/shop/page.tsx for
 * why this is a thin `basePath` variant rather than a separate build. */
export default async function ShopSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const membership = await requireHouseholdAccess();

  const [products, categories, draft, unreadCount] = await Promise.all([
    searchProducts(query),
    getCategories(),
    getDraftList(membership.householdId),
    getUnreadCount(),
  ]);

  return (
    <SearchResults
      query={query}
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
