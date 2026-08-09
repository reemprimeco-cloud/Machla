"use client";

import { Screen } from "@/components/ui/Primitives";
import type { Category, Product } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { AccountActions } from "../household/AccountActions";
import { CategoryGrid } from "./CategoryGrid";
import { ProductGrid } from "./QuantityStepper";
import { SearchBox, WorkerBar } from "./WorkerChrome";

export function WorkerHome({
  householdId,
  householdName,
  categories,
  frequent,
  quantities,
  itemCount,
}: {
  householdId: string;
  householdName: string;
  categories: Category[];
  frequent: Product[];
  quantities: Record<string, number>;
  itemCount: number;
}) {
  const { t } = useLocale();

  const iconByCategoryId = Object.fromEntries(
    categories.map((category) => [category.id, category.icon]),
  );

  return (
    <Screen>
      <WorkerBar title={householdName} itemCount={itemCount} />

      <p className="hl-title text-ink">{t("worker.browse")}</p>

      <SearchBox />

      {/* Frequently-bought comes before the categories: after a few shops
          it is where most of the list gets built, and it saves the worker
          navigating the taxonomy at all. Hidden until there is history,
          rather than shown empty. */}
      {frequent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="hl-label text-ink-muted">{t("worker.frequent")}</h2>
          <ProductGrid
            products={frequent}
            householdId={householdId}
            quantities={quantities}
            iconByCategoryId={iconByCategoryId}
          />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="hl-label text-ink-muted">{t("worker.categories")}</h2>
        <CategoryGrid categories={categories} />
      </section>

      <AccountActions />
    </Screen>
  );
}
