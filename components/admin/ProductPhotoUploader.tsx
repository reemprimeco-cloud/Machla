"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { uploadProductImageAction, uploadProductImageFromUrlAction } from "@/lib/admin/actions";
import type { AdminProductRow } from "@/lib/admin/queries";

function ProductRow({ product }: { product: AdminProductRow }) {
  const [pending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadProductImageAction(product.id, formData);
      if (result.ok) {
        setPreviewUrl(null);
        if (inputRef.current) inputRef.current.value = "";
        // The action revalidates the page, but this keeps the row's own
        // thumbnail correct immediately for this one click without
        // waiting on a full page refetch.
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
      const result = await uploadProductImageFromUrlAction(product.id, urlValue.trim());
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
            {product.icon ?? "📦"}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="hl-caption truncate text-ink">
            {product.nameAr}
            {product.brand ? ` — ${product.brand}` : ""}
          </p>
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
          <input ref={inputRef} type="file" name="file" accept="image/*" className="hl-caption w-24 text-xs" />
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

export function ProductPhotoUploader({ products }: { products: AdminProductRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return products;
    return products.filter(
      (p) => p.nameAr.includes(q) || p.nameEn.toLowerCase().includes(q.toLowerCase()),
    );
  }, [products, query]);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="ابحثي باسم المنتج..."
        className="hl-caption rounded-lg border border-line bg-surface px-3 py-2 text-ink"
      />
      <p className="hl-caption text-ink-muted">
        {filtered.length} من {products.length} صنف
      </p>
      <div className="rounded-lg border border-line bg-surface px-3">
        {filtered.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
