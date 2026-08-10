import { SearchResults } from "@/components/worker/SearchResults";
import { getCategories, searchProducts } from "@/lib/catalog/queries";
import { requireWorkerAccess } from "@/lib/household/guard";
import { getDraftList, quantitiesByProduct } from "@/lib/list/queries";
import { getUnreadCount } from "@/lib/notifications/queries";

/**
 * Search results.
 *
 * The query runs in Postgres via `search_products`, which searches all
 * nine localized name columns plus brand and transliteration aliases at
 * once — so a Filipino speaker typing "gatas" and a Hindi speaker typing
 * "doodh" both land on the same milk, whatever language the UI is in
 * (master plan Section 20).
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const membership = await requireWorkerAccess();

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
    />
  );
}
