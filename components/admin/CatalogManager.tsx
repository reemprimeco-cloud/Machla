"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import {
  createProductAction,
  setProductActiveAction,
  uploadProductImageAction,
  uploadProductImageFromUrlAction,
} from "@/lib/admin/actions";
import type { AdminCategoryRow, AdminProductRow } from "@/lib/admin/queries";

const UNITS = ["pcs", "kg", "g", "l", "ml", "pack", "box", "bottle", "bag", "other"];

function ProductManageRow({ product }: { product: AdminProductRow }) {
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(product.isActive);
  const [imageUrl, setImageUrl] = useState(product.imageUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggleActive() {
    setError(null);
    const next = !active;
    startTransition(async () => {
      const result = await setProductActiveAction(product.id, next);
      if (result.ok) setActive(next);
      else setError(result.message);
    });
  }

  function submitFile(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await uploadProductImageAction(product.id, formData);
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
    <div className={`flex flex-col gap-1 border-b border-line py-2 last:border-b-0 ${active ? "" : "opacity-50"}`}>
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
          {!active ? <p className="hl-caption text-ink-muted">معطّل</p> : null}
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

        <button
          type="button"
          disabled={pending}
          onClick={toggleActive}
          className={`hl-caption shrink-0 rounded-pill px-2 py-1 disabled:opacity-50 ${
            active ? "bg-danger/10 text-danger" : "bg-success/10 text-success"
          }`}
        >
          {pending ? "..." : active ? "حذف" : "استرجاع"}
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

function AddProductForm({ categoryId }: { categoryId: string }) {
  const [pending, startTransition] = useTransition();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [brand, setBrand] = useState("");
  const [icon, setIcon] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const result = await createProductAction({ categoryId, nameAr, nameEn, brand, icon, unit });
      if (result.ok) {
        setNameAr("");
        setNameEn("");
        setBrand("");
        setIcon("");
        setDone(true);
      } else {
        setError(result.message);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
      <p className="hl-label text-ink-muted">إضافة منتج جديد لهذا القسم</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={nameAr}
          onChange={(e) => setNameAr(e.target.value)}
          placeholder="الاسم بالعربي"
          className="hl-caption rounded-md border border-line bg-bg px-2 py-1.5"
        />
        <input
          type="text"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          placeholder="Name (English)"
          dir="ltr"
          className="hl-caption rounded-md border border-line bg-bg px-2 py-1.5"
        />
        <input
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="العلامة التجارية (اختياري)"
          className="hl-caption rounded-md border border-line bg-bg px-2 py-1.5"
        />
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="إيموجي (اختياري)"
          className="hl-caption rounded-md border border-line bg-bg px-2 py-1.5"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="hl-caption col-span-2 rounded-md border border-line bg-bg px-2 py-1.5"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="hl-caption text-danger">فشل: {error}</p> : null}
      {done ? <p className="hl-caption text-success">تمت الإضافة — ارفعي صورته من القائمة فوق.</p> : null}
      <button
        type="button"
        disabled={pending || !nameAr.trim() || !nameEn.trim()}
        onClick={submit}
        className="hl-caption rounded-pill bg-primary px-3 py-1.5 text-on-primary disabled:opacity-50"
      >
        {pending ? "جاري الإضافة..." : "إضافة"}
      </button>
    </div>
  );
}

export function CatalogManager({
  categories,
  products,
}: {
  categories: AdminCategoryRow[];
  products: AdminProductRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const countByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) map.set(p.categoryId, (map.get(p.categoryId) ?? 0) + 1);
    return map;
  }, [products]);

  const selectedProducts = useMemo(() => {
    if (!selectedId) return [];
    const inCategory = products.filter((p) => p.categoryId === selectedId);
    const q = query.trim();
    if (!q) return inCategory;
    return inCategory.filter((p) => p.nameAr.includes(q) || p.nameEn.toLowerCase().includes(q.toLowerCase()));
  }, [products, selectedId, query]);

  const selectedCategory = categories.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setSelectedId(c.id === selectedId ? null : c.id);
              setQuery("");
            }}
            className={`hl-caption rounded-pill border px-3 py-1.5 ${
              c.id === selectedId ? "border-primary bg-primary text-on-primary" : "border-line bg-surface text-ink"
            }`}
          >
            {c.icon ?? "📦"} {c.nameAr} ({countByCategory.get(c.id) ?? 0})
          </button>
        ))}
      </div>

      {selectedCategory ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`ابحثي داخل ${selectedCategory.nameAr}...`}
            className="hl-caption rounded-lg border border-line bg-surface px-3 py-2 text-ink"
          />
          <div className="rounded-lg border border-line bg-surface px-3">
            {selectedProducts.length === 0 ? (
              <p className="hl-caption py-3 text-ink-muted">لا يوجد منتجات</p>
            ) : (
              selectedProducts.map((p) => <ProductManageRow key={p.id} product={p} />)
            )}
          </div>
          <AddProductForm categoryId={selectedCategory.id} />
        </div>
      ) : null}
    </div>
  );
}
