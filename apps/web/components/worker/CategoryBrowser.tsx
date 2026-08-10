"use client";

import { Card, Screen } from "@/components/ui/Primitives";
import { localizedName } from "@/lib/catalog/localized";
import type { Category, Product } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { ProductGrid } from "./QuantityStepper";
import { WorkerBar } from "./WorkerChrome";

export function CategoryBrowser({
  category,
  products,
  categories,
  householdId,
  quantities,
  itemCount,
  unreadCount,
}: {
  category: Category;
  products: Product[];
  categories: Category[];
  householdId: string;
  quantities: Record<string, number>;
  itemCount: number;
  unreadCount: number;
}) {
  const { t, locale } = useLocale();

  const iconByCategoryId = Object.fromEntries(
    categories.map((entry) => [entry.id, entry.icon]),
  );

  return (
    <Screen>
      <WorkerBar
        title={`${category.icon ?? ""} ${localizedName(category, locale)}`.trim()}
        backHref="/worker"
        itemCount={itemCount}
        unreadCount={unreadCount}
      />

      {products.length === 0 ? (
        <Card>
          <p className="hl-body text-ink-muted">{t("worker.noProducts")}</p>
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
