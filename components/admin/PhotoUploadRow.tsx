"use client";

import { useRef, useState, useTransition } from "react";

import { uploadCatalogImageAction, uploadCatalogImageFromUrlAction } from "@/lib/admin/actions";

/** Compact single-line row, matching ProductPhotoUploader's ProductRow
 * density — the earlier full-width card layout made this list (25 KFM
 * rows) feel much bigger than the Tamween list for the exact same job. */
export function PhotoUploadRow({
  path,
  label,
  initiallyUploaded,
}: {
  path: string;
  label: string;
  initiallyUploaded: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [uploaded, setUploaded] = useState(initiallyUploaded);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
  }

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadCatalogImageAction(path, formData);
      if (result.ok) {
        setUploaded(true);
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
      } else {
        setError(result.message);
      }
    });
  }

  function submitUrl() {
    if (!urlValue.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadCatalogImageFromUrlAction(path, urlValue.trim());
      if (result.ok) {
        setUploaded(true);
        setUrlValue("");
        setShowUrlInput(false);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className="size-10 shrink-0 rounded-md border border-line object-cover" />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xl">
            {uploaded ? "✅" : "🖼️"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="hl-caption truncate text-ink">{label}</p>
          {error ? <p className="hl-caption text-danger">فشل: {error}</p> : null}
        </div>

        <form
          action={submit}
          className="flex shrink-0 items-center gap-1"
          onSubmit={(e) => {
            const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement) ?? null;
            if (input?.files?.[0]) setPreviewUrl(URL.createObjectURL(input.files[0]));
          }}
        >
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept="image/*"
            onChange={onFileChange}
            className="hl-caption w-24 text-xs"
          />
          <button
            type="submit"
            disabled={pending}
            className="hl-caption shrink-0 rounded-pill bg-primary px-2 py-1 text-on-primary disabled:opacity-50"
          >
            {pending ? "..." : uploaded ? "إعادة" : "رفع"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setShowUrlInput((v) => !v)}
          className="hl-caption shrink-0 text-primary"
          aria-label="رفع من رابط"
        >
          🔗
        </button>
      </div>

      {showUrlInput ? (
        <div className="flex items-center gap-1 ps-12" dir="ltr">
          <input
            type="url"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            placeholder="https://..."
            className="hl-caption min-w-0 flex-1 rounded-md border border-line bg-bg px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={pending || !urlValue.trim()}
            onClick={submitUrl}
            className="hl-caption shrink-0 rounded-pill bg-primary px-2 py-1 text-on-primary disabled:opacity-50"
          >
            {pending ? "..." : "رفع"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
