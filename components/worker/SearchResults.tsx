"use client";

import { Card, Screen } from "@/components/ui/Primitives";
import type { Category, Product } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { ProductGrid } from "./QuantityStepper";
import { SearchBox, WorkerBar } from "./WorkerChrome";

export function SearchResults({
  query,
  products,
  categories,
  householdId,
  quantities,
  itemCount,
  unreadCount,
  basePath = "/worker",
  targetListId,
}: {
  query: string;
  products: Product[];
  categories: Category[];
  householdId: string;
  quantities: Record<string, number>;
  itemCount: number;
  unreadCount: number;
  basePath?: string;
  targetListId?: string;
}) {
  const { t } = useLocale();

  const iconByCategoryId = Object.fromEntries(
    categories.map((category) => [category.id, category.icon]),
  );

  return (
    <Screen>
      <WorkerBar
        title={t("worker.searchPlaceholder")}
        backHref={basePath}
        itemCount={itemCount}
        unreadCount={unreadCount}
        basePath={basePath}
        targetListId={targetListId}
      />

      <SearchBox initialQuery={query} basePath={basePath} targetListId={targetListId} />

      {products.length === 0 ? (
        <Card>
          <p className="hl-body text-ink-muted">{t("worker.searchNoResults", { query })}</p>
        </Card>
      ) : (
        <ProductGrid
          products={products}
          householdId={householdId}
          quantities={quantities}
          iconByCategoryId={iconByCategoryId}
          targetListId={targetListId}
        />
      )}
    </Screen>
  );
}
