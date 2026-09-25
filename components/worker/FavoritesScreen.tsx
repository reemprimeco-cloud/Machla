"use client";

import { Card, Screen } from "@/components/ui/Primitives";
import type { Category, Product } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { ProductGrid } from "./QuantityStepper";
import { WorkerBar } from "./WorkerChrome";

/** The one implicit favorites list every person has — simplified
 * version (no naming, no multiple lists) the owner chose over the
 * fuller "named lists + picker" design. Reuses ProductGrid so a saved
 * product can go straight back into today's list from here, which is
 * the whole point of favoriting something in the first place. */
export function FavoritesScreen({
  products,
  categories,
  householdId,
  quantities,
  itemCount,
  unreadCount,
  basePath = "/worker",
}: {
  products: Product[];
  categories: Category[];
  householdId: string;
  quantities: Record<string, number>;
  itemCount: number;
  unreadCount: number;
  basePath?: string;
}) {
  const { t } = useLocale();

  const iconByCategoryId = Object.fromEntries(categories.map((c) => [c.id, c.icon]));
  const favoriteProductIds = new Set(products.map((p) => p.id));

  return (
    <Screen>
      <WorkerBar
        title={t("worker.favorites")}
        backHref={basePath}
        itemCount={itemCount}
        unreadCount={unreadCount}
        basePath={basePath}
      />

      {products.length === 0 ? (
        <Card>
          <p className="hl-body text-ink-muted">{t("worker.favoritesEmpty")}</p>
          <p className="hl-caption text-ink-muted">{t("worker.favoritesEmptyHint")}</p>
        </Card>
      ) : (
        <ProductGrid
          products={products}
          householdId={householdId}
          quantities={quantities}
          iconByCategoryId={iconByCategoryId}
          favoriteProductIds={favoriteProductIds}
        />
      )}
    </Screen>
  );
}
