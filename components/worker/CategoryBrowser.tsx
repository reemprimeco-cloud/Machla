"use client";

import { Card, Screen } from "@/components/ui/Primitives";
import { localizedName } from "@/lib/catalog/localized";
import type { Category, GroupedProducts } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { ProductGrid } from "./QuantityStepper";
import { WorkerBar } from "./WorkerChrome";

export function CategoryBrowser({
  category,
  groupedProducts,
  categories,
  householdId,
  quantities,
  itemCount,
  unreadCount,
  basePath = "/worker",
  targetListId,
}: {
  category: Category;
  groupedProducts: GroupedProducts;
  categories: Category[];
  householdId: string;
  quantities: Record<string, number>;
  itemCount: number;
  unreadCount: number;
  basePath?: string;
  targetListId?: string;
}) {
  const { t, locale } = useLocale();

  const iconByCategoryId = Object.fromEntries(
    categories.map((entry) => [entry.id, entry.icon]),
  );
  const { ungrouped, groups } = groupedProducts;
  const isEmpty = ungrouped.length === 0 && groups.every((g) => g.products.length === 0);

  return (
    <Screen>
      <WorkerBar
        title={`${category.icon ?? ""} ${localizedName(category, locale)}`.trim()}
        backHref={basePath}
        itemCount={itemCount}
        unreadCount={unreadCount}
        basePath={basePath}
        targetListId={targetListId}
      />

      {isEmpty ? (
        <Card>
          <p className="hl-body text-ink-muted">{t("worker.noProducts")}</p>
        </Card>
      ) : (
        <>
          {ungrouped.length > 0 ? (
            <ProductGrid
              products={ungrouped}
              householdId={householdId}
              quantities={quantities}
              iconByCategoryId={iconByCategoryId}
              targetListId={targetListId}
            />
          ) : null}

          {/* A subcategory (products.subcategory_id) — most of a
              category stays in the flat grid above; this pulls out a
              specific, worth-labeling slice (e.g. "منتجات الأطفال"
              inside Tamween) into its own section instead of leaving it
              mixed in. */}
          {groups.map((group) =>
            group.products.length > 0 ? (
              <section key={group.subcategory.id} className="space-y-2">
                <h2 className="hl-label text-ink-muted">
                  <span aria-hidden className="me-1">
                    {group.subcategory.icon}
                  </span>
                  {localizedName(group.subcategory, locale)}
                </h2>
                <ProductGrid
                  products={group.products}
                  householdId={householdId}
                  quantities={quantities}
                  iconByCategoryId={iconByCategoryId}
                  targetListId={targetListId}
                />
              </section>
            ) : null,
          )}
        </>
      )}
    </Screen>
  );
}
