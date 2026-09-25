import { SearchResults } from "@/components/worker/SearchResults";
import { getCategories, searchProducts } from "@/lib/catalog/queries";
import { getFavoriteProductIds } from "@/lib/favorites/queries";
import { requireHouseholdAccess } from "@/lib/household/guard";
import { getUnreadCount } from "@/lib/notifications/queries";

/** Search results, adding to a received list — mirrors
 * app/worker/search/page.tsx, targeting a specific already-sent list. See
 * components/household/AddToListScreen.tsx. */
export default async function AddToListSearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id } = await params;
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const membership = await requireHouseholdAccess();

  const [products, categories, unreadCount, favoriteProductIds] = await Promise.all([
    searchProducts(query),
    getCategories(),
    getUnreadCount(),
    getFavoriteProductIds(),
  ]);

  return (
    <SearchResults
      query={query}
      products={products}
      categories={categories}
      householdId={membership.householdId}
      quantities={{}}
      itemCount={0}
      unreadCount={unreadCount}
      basePath={`/home/lists/${id}/add`}
      targetListId={id}
      favoriteProductIds={favoriteProductIds}
    />
  );
}
