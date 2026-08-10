"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { Card, ErrorText, PrimaryButton, Screen, SecondaryButton } from "@/components/ui/Primitives";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { addPhotoItemAction, ensureDraftAction } from "@/lib/list/actions";
import type { ListErrorCode } from "@/lib/list/errors";
import { createClient } from "@/lib/supabase/client";
import { downscaleToJpeg, PHOTO_MAX_BYTES } from "@/lib/list/photo";

/**
 * "It isn't in the list" — the worker photographs the thing instead.
 *
 * Deliberately not a live camera preview: `<input capture>` hands off to
 * the phone's own camera app, which every user already knows how to use,
 * works when the PWA has no camera permission of its own, and costs no
 * JavaScript. A custom getUserMedia viewfinder would be a worse version
 * of an app they use daily.
 */
export function PhotoCapture({
  householdId,
  listId,
}: {
  householdId: string;
  /** The draft as it existed at render time; null if the worker has not
   * added anything yet. Not required — `add` creates one on demand,
   * because photographing may well be the first thing they do. */
  listId: string | null;
}) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<ListErrorCode | "TOO_LARGE" | null>(null);
  const [pending, startTransition] = useTransition();

  async function onPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    if (!picked) return;
    setError(null);

    try {
      // A modern phone camera produces 4-8 MB, well over the bucket's
      // limit and pointless for a thumbnail someone glances at in an
      // aisle. Downscaling in the browser also means the upload finishes
      // on a slow connection.
      const shrunk = await downscaleToJpeg(picked);
      if (shrunk.size > PHOTO_MAX_BYTES) {
        setError("TOO_LARGE");
        return;
      }
      setFile(shrunk);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(shrunk);
      });
    } catch {
      setError("TOO_LARGE");
    }
  }

  function add() {
    if (!file) return;

    startTransition(async () => {
      setError(null);

      // The list id is part of the object path, so unlike a product add
      // the draft must exist BEFORE the upload rather than being created
      // by it. Idempotent: one open draft per person per household.
      const draft = listId
        ? ({ ok: true, value: listId } as const)
        : await ensureDraftAction(householdId, locale);

      if (!draft.ok) {
        setError(draft.code);
        return;
      }

      const supabase = createClient();

      // The path IS the authorization: the storage policy reads the
      // household id from its first segment. The list id is here so the
      // RPC can bind the object to this specific list — the policy alone
      // cannot see that part.
      const name = `${crypto.randomUUID()}.jpg`;
      const path = `${householdId}/${draft.value}/${name}`;

      const { error: uploadError } = await supabase.storage
        .from("list-photos")
        .upload(path, file, { contentType: "image/jpeg", upsert: false });

      if (uploadError) {
        setError("UNKNOWN");
        return;
      }

      const result = await addPhotoItemAction(draft.value, path, quantity, null);
      if (!result.ok) {
        setError(result.code);
        return;
      }

      setFile(null);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return null;
      });
      setQuantity(1);
      router.push("/worker/list");
      router.refresh();
    });
  }

  return (
    <Screen>
      <div className="space-y-1">
        <h1 className="hl-title text-ink">{t("worker.photoTitle")}</h1>
        <p className="hl-caption">{t("worker.photoHint")}</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        // Asks the phone for its rear camera. Desktop browsers ignore it
        // and show a file picker, which is the right fallback.
        capture="environment"
        onChange={onPicked}
        className="sr-only"
      />

      {previewUrl ? (
        <Card className="space-y-4">
          {/* eslint-disable-next-line @next/next/no-img-element --
              an object: URL for a file that never leaves the device until
              the worker confirms; next/image cannot take one. */}
          <img
            src={previewUrl}
            alt=""
            className="max-h-72 w-full rounded-lg border border-sand object-contain"
          />

          <div className="flex items-center justify-between gap-3">
            <span className="hl-label text-ink">{t("worker.photoItem")}</span>
            <div className="flex shrink-0 items-center gap-2">
              <StepButton
                label="−"
                onClick={() => setQuantity((n) => Math.max(1, n - 1))}
                disabled={pending || quantity <= 1}
              />
              <span className="hl-label w-8 text-center tabular-nums text-ink">{quantity}</span>
              <StepButton
                label="+"
                onClick={() => setQuantity((n) => Math.min(999, n + 1))}
                disabled={pending}
              />
            </div>
          </div>

          <PrimaryButton onClick={add} disabled={pending}>
            {pending ? t("worker.photoAdding") : t("worker.photoAdd")}
          </PrimaryButton>

          <SecondaryButton
            onClick={() => inputRef.current?.click()}
            disabled={pending}
            className="w-full"
          >
            {t("worker.photoRetake")}
          </SecondaryButton>
        </Card>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-sand bg-surface text-ink"
        >
          <span aria-hidden className="text-5xl leading-none">
            📷
          </span>
          <span className="hl-label">{t("worker.photoTake")}</span>
        </button>
      )}

      <ErrorText>
        {error === "TOO_LARGE"
          ? t("worker.photoTooLarge")
          : error
            ? t("worker.photoFailed")
            : null}
      </ErrorText>
    </Screen>
  );
}

/* A local stepper rather than QuantityStepper: that one is bound to a
   product id and writes through setProductQuantityAction on every tap.
   Here there is no product and nothing to write yet — the quantity is
   just state until the worker confirms the upload. */
function StepButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex size-12 items-center justify-center rounded-pill border border-sand bg-surface text-xl text-ink disabled:opacity-40"
    >
      <span aria-hidden>{label}</span>
    </button>
  );
}
