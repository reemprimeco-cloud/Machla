"use client";

import { useState } from "react";

import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * A photographed item's picture: a small thumbnail that opens full-size on
 * tap.
 *
 * The whole point of a photographed item (19-photo-items.md §1) is that the
 * picture IS the name — a 40-56px crop is rarely enough to actually
 * recognise the product from, which is what this exists to fix. Rendered as
 * a <button> so it is reachable by keyboard and announces itself to a
 * screen reader, rather than a plain <img> someone can only squint at.
 *
 * `purged` renders the same "photo unavailable" placeholder used before
 * this component existed (20260810160000_photo_retention.sql) — nothing to
 * open once the blob is gone.
 */
export function PhotoThumbnail({
  photoUrl,
  purged,
  label,
  sizeClassName = "size-14",
}: {
  photoUrl: string | null;
  purged: boolean;
  label: string;
  sizeClassName?: string;
}) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  if (purged) {
    return (
      <span
        aria-label={t("worker.photoUnavailable")}
        className={`flex ${sizeClassName} shrink-0 items-center justify-center rounded-lg border border-dashed border-sand text-ink-faint`}
      >
        <span aria-hidden className="text-lg">
          🗑
        </span>
      </span>
    );
  }

  if (!photoUrl) return null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          // This thumbnail sits inside a larger row that toggles purchase
          // status on click elsewhere — it must not also trigger that.
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${t("worker.photoView")} — ${label}`}
        className={`${sizeClassName} shrink-0 overflow-hidden rounded-lg border border-sand`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element --
            a signed, short-lived URL; next/image would proxy and cache it
            past its expiry (see ListChecklist for the full reasoning). */}
        <img src={photoUrl} alt="" className="size-full object-cover" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("common.back")}
            className="absolute end-4 top-4 flex size-12 items-center justify-center rounded-pill bg-surface text-ink"
          >
            <span aria-hidden className="text-lg leading-none">
              ✕
            </span>
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element --
              same signed URL as the thumbnail above. */}
          <img
            src={photoUrl}
            alt={label}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
