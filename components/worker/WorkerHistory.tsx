"use client";

import Link from "next/link";

import { Card, Screen } from "@/components/ui/Primitives";
import { Progress } from "@/components/household/ListsInbox";
import type { HouseholdList } from "@/lib/list/household";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { MessageKey } from "@/lib/i18n/messages";

const STATUS_KEYS: Record<string, MessageKey> = {
  sent: "hlists.statusSent",
  viewed: "hlists.statusViewed",
  completed: "hlists.statusCompleted",
};

/** What happened to the lists this worker sent. Read-only: a sent list is
 * a record of what was asked for, and nothing here can change it. */
export function WorkerHistory({ lists }: { lists: HouseholdList[] }) {
  const { t, locale } = useLocale();

  return (
    <Screen title={t("notif.myLists")}>
      {lists.length === 0 ? (
        <Card>
          <p className="hl-heading text-ink">{t("notif.noMyLists")}</p>
          <p className="hl-caption mt-1">{t("worker.emptyListHint")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {lists.map((list) => {
            const total = Number(list.total_items);
            const purchased = Number(list.purchased_items);
            return (
              <li
                key={list.id}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-4 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="hl-caption">
                    {list.sent_at
                      ? new Date(list.sent_at).toLocaleString(locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : null}
                  </span>
                  <span className="hl-caption rounded-pill bg-surface-2 px-2 py-0.5 text-ink-muted">
                    {t(STATUS_KEYS[list.status] ?? "hlists.statusSent")}
                  </span>
                </div>
                <Progress
                  purchased={purchased}
                  total={total}
                  percent={total ? Math.round((purchased / total) * 100) : 0}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/worker"
        className="hl-label text-center text-primary underline"
      >
        {t("common.back")}
      </Link>
    </Screen>
  );
}
