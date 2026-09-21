"use client";

import Link from "next/link";

import { CategoryGrid } from "@/components/worker/CategoryGrid";
import { SearchBox } from "@/components/worker/WorkerChrome";
import { Screen } from "@/components/ui/Primitives";
import type { Category } from "@/lib/catalog/queries";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The household side's entry point onto add_item_to_sent_list
 * (20260921100000_add_item_after_send.sql) — "I forgot to ask for
 * something" for an owner/member, reached from ListChecklist.tsx's own
 * "add item" button. Reuses CategoryGrid/SearchBox unchanged (they
 * already accept a `targetListId`, built for the worker's mirror flow in
 * SentConfirmation.tsx) rather than WorkerHome: that component carries
 * worker-only chrome (AccountActions, the "my draft" basket) that has no
 * meaning here — there is no draft on this side, only the received list
 * being added to.
 */
export function AddToListScreen({
  listId,
  categories,
  backHref,
}: {
  listId: string;
  categories: Category[];
  backHref: string;
}) {
  const { t } = useLocale();
  const basePath = `/home/lists/${listId}/add`;

  return (
    <Screen>
      <div className="flex items-center gap-3">
        <Link
          href={backHref}
          aria-label={t("common.back")}
          className="flex size-12 shrink-0 items-center justify-center rounded-pill border border-line bg-surface text-ink"
        >
          <span aria-hidden className="rtl:-scale-x-100 text-lg leading-none">
            ‹
          </span>
        </Link>
        <h1 className="hl-title min-w-0 flex-1 truncate text-ink">{t("hlists.addItem")}</h1>
      </div>

      <SearchBox basePath={basePath} targetListId={listId} />

      <section className="space-y-3">
        <h2 className="hl-label text-ink-muted">{t("worker.categories")}</h2>
        <CategoryGrid categories={categories} basePath={basePath} targetListId={listId} />
      </section>
    </Screen>
  );
}
