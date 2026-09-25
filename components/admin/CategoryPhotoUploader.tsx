"use client";

import { useRef, useState, useTransition } from "react";

import { uploadCategoryImageAction, uploadCategoryImageFromUrlAction } from "@/lib/admin/actions";
import type { AdminCategoryRow } from "@/lib/admin/queries";

function CategoryRow({ category }: { category: AdminCategoryRow }) {
  const [pending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(category.imageUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submitFile(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadCategoryImageAction(category.id, formData);
      if (result.ok) {
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
        const file = formData.get("file");
        if (file instanceof File) setImageUrl(URL.createObjectURL(file));
      } else {
        setError(result.message);
      }
    });
  }

  function submitUrl() {
    if (!urlValue.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await uploadCategoryImageFromUrlAction(category.id, urlValue.trim());
      if (result.ok) {
        setImageUrl(urlValue.trim());
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
        {previewUrl ?? imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl ?? imageUrl ?? undefined}
            alt=""
            className="size-10 shrink-0 rounded-md border border-line object-cover"
          />
        ) : (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xl">
            {category.icon ?? "📦"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="hl-caption truncate text-ink">{category.nameAr}</p>
          {error ? <p className="hl-caption text-danger">فشل: {error}</p> : null}
        </div>

        <form
          action={submitFile}
          className="flex shrink-0 items-center gap-1"
          onSubmit={(e) => {
            const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement) ?? null;
            if (input?.files?.[0]) setPreviewUrl(URL.createObjectURL(input.files[0]));
          }}
        >
          <input ref={inputRef} type="file" name="file" accept="image/*" className="hl-caption w-20 text-xs" />
          <button
            type="submit"
            disabled={pending}
            className="hl-caption shrink-0 rounded-pill bg-primary px-2 py-1 text-on-primary disabled:opacity-50"
          >
            {pending ? "..." : "رفع"}
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

/** Category tile images (categories.image_url) — the logo shown on the
 * main category grid instead of the emoji icon, e.g. KFM/Tamween's real
 * logos (20260925110000_categories_image_url.sql). Every category gets
 * a row here now, not just the two done by hand so far. */
export function CategoryPhotoUploader({ categories }: { categories: AdminCategoryRow[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3">
      {categories.map((c) => (
        <CategoryRow key={c.id} category={c} />
      ))}
    </div>
  );
}
