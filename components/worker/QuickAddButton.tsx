"use client";

import { useState, useTransition } from "react";

import { CheckIcon } from "@/components/ui/Icons";
import { addItemToSentListAction } from "@/lib/list/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * The "add more to a list I already sent" control — a sibling to
 * QuantityStepper, not a variant of it. add_item_to_sent_list
 * (20260921100000_add_item_after_send.sql) only ever ADDS: there is no
 * RPC to take an item back off a list someone else may already be
 * shopping from, so this is a one-way tap, not a −/+ stepper. The count
 * shown is this session's own taps, purely as feedback that something
 * landed — not a synced read of the list's real quantity, which this
 * component never fetches.
 */
export function QuickAddButton({
  listId,
  productId,
  label,
}: {
  listId: string;
  productId: string;
  label: string;
}) {
  const { t } = useLocale();
  const [, startTransition] = useTransition();
  const [added, setAdded] = useState(0);

  function handleAdd() {
    setAdded((count) => count + 1);
    startTransition(async () => {
      await addItemToSentListAction(listId, productId, 1);
    });
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      aria-label={`${t("worker.add")} — ${label}`}
      className="hl-label flex min-h-12 w-full items-center justify-center gap-1.5 rounded-pill bg-primary px-4 text-on-primary transition-colors duration-150 ease-hl active:bg-primary-hover"
    >
      {added > 0 ? (
        <>
          <CheckIcon className="size-4" />
          {added}
        </>
      ) : (
        t("worker.add")
      )}
    </button>
  );
}
