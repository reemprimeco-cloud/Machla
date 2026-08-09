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
}: {
  query: string;
  products: Product[];
  categories: Category[];
  householdId: string;
  quantities: Record<string, number>;
  itemCount: number;
}) {
  const { t } = useLocale();

  const iconByCategoryId = Object.fromEntries(
    categories.map((category) => [category.id, category.icon]),
  );

  return (
    <Screen>
      <WorkerBar title={t("worker.searchPlaceholder")} backHref="/worker" itemCount={itemCount} />

      <SearchBox initialQuery={query} />

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
        />
      )}
    </Screen>
  );
}
