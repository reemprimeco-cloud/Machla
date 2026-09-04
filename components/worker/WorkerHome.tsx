"use client";

import Link from "next/link";

import { InstallGuide } from "@/components/pwa/InstallGuide";
import { Screen } from "@/components/ui/Primitives";
import type { Category } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

import { AccountActions } from "../household/AccountActions";
import { CategoryGrid } from "./CategoryGrid";
import { SearchBox, WorkerBar } from "./WorkerChrome";

export function WorkerHome({
  householdName,
  categories,
  itemCount,
  unreadCount,
  basePath = "/worker",
}: {
  householdName: string;
  categories: Category[];
  itemCount: number;
  unreadCount: number;
  /** Set by `app/home/shop/page.tsx` when a household owner/member is
   * building their own list — the mechanism is identical to the worker's,
   * only where the links point differs. Account actions (`/worker`-only
   * chrome) are skipped in that case: those live in the Settings tab on
   * the household side, so showing them here would be redundant. */
  basePath?: string;
}) {
  const { t } = useLocale();
  const isWorker = basePath === "/worker";

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

      <section className="space-y-3">
        <h2 className="hl-label text-ink-muted">{t("worker.categories")}</h2>
        <CategoryGrid categories={categories} basePath={basePath} />
      </section>

      <Link
        // The worker's own sent lists live at /worker/lists; a household
        // member's (basePath="/home/shop") live alongside everyone
        // else's at /home/lists, not /home/shop/lists.
        href={isWorker ? "/worker/lists" : "/home/lists"}
        className="flex min-h-14 items-center rounded-lg border border-line bg-surface px-5 shadow-sm active:bg-surface-2"
      >
        <span className="hl-heading text-ink">{t("notif.myLists")}</span>
      </Link>

      {isWorker ? <AccountActions /> : null}
    </Screen>
  );
}
