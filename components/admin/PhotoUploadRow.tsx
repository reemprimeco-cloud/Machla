"use client";

import { useRef, useState, useTransition } from "react";

import { uploadCatalogImageAction } from "@/lib/admin/actions";

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

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-sm">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="" className="size-14 shrink-0 rounded-md border border-line object-contain bg-surface-2" />
      ) : (
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-surface-2 text-2xl">
          {uploaded ? "✅" : "🖼️"}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="hl-label text-ink">{label}</p>
        <p className="hl-caption break-all text-ink-muted" dir="ltr">
          {path}
        </p>
        {uploaded ? <p className="hl-caption text-success">تم الرفع</p> : null}
        {error ? <p className="hl-caption text-danger">فشل: {error}</p> : null}
      </div>

      <form action={submit} className="shrink-0">
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept="image/*"
          onChange={onFileChange}
          className="hl-caption block w-32"
        />
        <button
          type="submit"
          disabled={pending}
          className="hl-caption mt-1 w-full rounded-pill bg-primary px-3 py-1 text-on-primary disabled:opacity-50"
        >
          {pending ? "جاري الرفع..." : uploaded ? "إعادة الرفع" : "رفع"}
        </button>
      </form>
    </div>
  );
}
