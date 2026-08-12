"use client";

import { useOptimistic, useState, useTransition } from "react";

import { setItemNoteAction } from "@/lib/list/actions";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * An optional note under a catalogue product — "lactose-free", "1 piece",
 * whatever distinguishes what's actually wanted from the single generic
 * catalogue entry (Milk, Yogurt, ... none of them broken out by size or
 * variant). The column and the RPC parameter already existed for photo
 * items; this is the same field, just now editable for an ordinary
 * product too, from the review screen — not the browse grid, where a
 * two-column tile has no room to type into.
 */
export function NoteField({
  listId,
  productId,
  quantity,
  note,
}: {
  listId: string;
  productId: string;
  quantity: number;
  note: string | null;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [pending, startTransition] = useTransition();
  const [optimisticNote, setOptimisticNote] = useOptimistic(note);

  function save() {
    const next = draft.trim() || null;
    setEditing(false);
    if (next === optimisticNote) return;
    startTransition(async () => {
      setOptimisticNote(next);
      await setItemNoteAction(listId, productId, quantity, next);
    });
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={save}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            save();
          }
        }}
        placeholder={t("worker.noteHint")}
        maxLength={140}
        disabled={pending}
        className="hl-caption min-h-10 w-full rounded-md border border-line bg-surface px-3 text-ink outline-none focus-visible:border-primary"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(optimisticNote ?? "");
        setEditing(true);
      }}
      disabled={pending}
      className="hl-caption self-start truncate text-start text-primary underline underline-offset-2 disabled:opacity-60"
    >
      {optimisticNote ? `“${optimisticNote}”` : t("worker.addNote")}
    </button>
  );
}
