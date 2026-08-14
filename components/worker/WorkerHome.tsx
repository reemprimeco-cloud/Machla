"use client";

import Link from "next/link";

import { InstallGuide } from "@/components/pwa/InstallGuide";
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
  unreadCount,
  basePath = "/worker",
}: {
  householdId: string;
  householdName: string;
  categories: Category[];
  frequent: Product[];
  quantities: Record<string, number>;
  itemCount: number;
  unreadCount: number;
  /** Set by `app/home/shop/page.tsx` when a household owner/member is
   * building their own list — the mechanism is identical to the worker's,
   * only where the links point differs. `/worker`-only chrome ("My
   * lists", account actions) is skipped in that case: a sent list here
   * already shows up in `/home/lists` alongside everyone else's, and
   * account actions live in the Settings tab, so both would be
   * redundant. */
  basePath?: string;
}) {
  const { t } = useLocale();
  const isWorker = basePath === "/worker";

  const iconByCategoryId = Object.fromEntries(
    categories.map((category) => [category.id, category.icon]),
  );

  return (
    <Screen>
      <WorkerBar
        title={householdName}
        itemCount={itemCount}
        unreadCount={unreadCount}
        basePath={basePath}
      />

      <p className="hl-title text-ink">{t("worker.browse")}</p>

      <SearchBox basePath={basePath} />

      <InstallGuide />

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
        <CategoryGrid categories={categories} basePath={basePath} />
      </section>

      {isWorker ? (
        <Link
          href="/worker/lists"
          className="flex min-h-14 items-center rounded-lg border border-line bg-surface px-5 shadow-sm active:bg-surface-2"
        >
          <span className="hl-heading text-ink">{t("notif.myLists")}</span>
        </Link>
      ) : null}

      {isWorker ? <AccountActions /> : null}
    </Screen>
  );
}
