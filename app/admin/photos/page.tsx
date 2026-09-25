import Link from "next/link";

import { CatalogManager } from "@/components/admin/CatalogManager";
import { CategoryPhotoUploader } from "@/components/admin/CategoryPhotoUploader";
import { CollapsibleSection } from "@/components/admin/CollapsibleSection";
import { PhotoUploadRow } from "@/components/admin/PhotoUploadRow";
import { ProductPhotoUploader } from "@/components/admin/ProductPhotoUploader";
import { requireAdminAccess } from "@/lib/admin/guard";
import { getCatalogForAdmin, getUploadedImagePaths } from "@/lib/admin/queries";

/**
 * Replaces the claude-artifact uploader (2026-09-25): that page ran
 * client-side inside claude.ai's sandboxed iframe, whose CSP silently
 * blocks fetch/XHR to any third-party origin — every "upload" from it
 * failed with a bare "Load failed", nothing ever reached Supabase
 * Storage. This route runs the same upload as a Server Action instead,
 * so the request goes from Vercel to Supabase directly, no browser
 * sandbox involved.
 *
 * PENDING is a short-lived hand-typed list, not a general media
 * library — add an entry here each time Claude preps a new image for
 * the owner to upload, remove it once it's live.
 */
const PENDING: { path: string; label: string }[] = [
  { path: "kfm_burger_buns_gf.webp", label: "خبز برجر خالي من الجلوتين — المطاحن" },
  { path: "kfm_rolls_gf.webp", label: "خبز رول خالي من الجلوتين — المطاحن" },
  { path: "kfm_cupcake_gf.webp", label: "كب كيك خالي من الجلوتين — المطاحن" },
  { path: "kfm_toast_gf.webp", label: "توست خالي من الجلوتين — المطاحن" },
  { path: "kfm_rusk.webp", label: "شابورة المطاحن" },
  { path: "kfm_dates_cupcake.webp", label: "كب كيك محشي تمر — المطاحن" },
  { path: "kfm_french_bread_brown.webp", label: "خبز فرنسي بالحبوب — المطاحن" },
  { path: "kfm_french_bread_white.webp", label: "خبز فرنسي أبيض — المطاحن" },
  { path: "kfm_brioche.webp", label: "البريوش — المطاحن" },
  { path: "kfm_slider_bun.webp", label: "سلايدر خبز البطاطس — المطاحن" },
  { path: "kfm_hotdog_bun.webp", label: "خبز هوت دوج رول — المطاحن" },
  { path: "kfm_toast_original.webp", label: "التوست الأصلي — المطاحن" },
  { path: "kfm_protein_bread.webp", label: "خبز البروتين — المطاحن" },
  { path: "kfm_shawerma_bread.webp", label: "خبز الشاورما — المطاحن" },
  { path: "kfm_rugag_white.webp", label: "خبز الرقاق الأبيض — المطاحن" },
  { path: "kfm_rugag_brown.webp", label: "خبز الرقاق الأسمر — المطاحن" },
  { path: "kfm_dalal_corn_oil.webp", label: "زيت الذرة دلال" },
  { path: "kfm_dalal_sunflower_oil.webp", label: "زيت دوار الشمس دلال" },
  { path: "kfm_dalal_ghee.webp", label: "سمن نباتي دلال" },
  { path: "kfm_aljoud_corn_oil.webp", label: "زيت الذرة الجود" },
  { path: "kfm_aljoud_sunflower_oil.webp", label: "زيت دوار الشمس الجود" },
  { path: "kfm_biscuits_digestive.webp", label: "بسكويت دايجستيف — المطاحن" },
  { path: "kfm_biscuits_totally_bran.webp", label: "بسكويت توتالي بران — المطاحن" },
  { path: "kfm_biscuits_digestive_nosugar.webp", label: "دايجستيف بدون سكر مضاف — المطاحن" },
  { path: "kfm_biscuits_tik_salty.webp", label: "بسكويت مالح تيك — المطاحن" },
];

export default async function AdminPhotosPage() {
  await requireAdminAccess();
  const [uploaded, catalog] = await Promise.all([
    getUploadedImagePaths(PENDING.map((p) => p.path)),
    getCatalogForAdmin(),
  ]);
  const activeProducts = catalog.products.filter((p) => p.isActive);

  return (
    <main dir="rtl" className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-4 bg-bg px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="hl-title text-ink">رفع صور المنتجات</h1>
        <Link href="/admin" className="hl-label text-primary underline">
          رجوع
        </Link>
      </div>

      {PENDING.length > 0 ? (
        <CollapsibleSection
          title={`شعارات وصور جاهزها Claude (${PENDING.length})`}
          subtitle='اختاري الصورة من جهازك لكل صنف واضغطي "رفع".'
        >
          <div className="flex flex-col gap-1">
            {PENDING.map((item) => (
              <PhotoUploadRow
                key={item.path}
                path={item.path}
                label={item.label}
                initiallyUploaded={uploaded.has(item.path)}
              />
            ))}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection
        title={`صور كل المنتجات (${activeProducts.length})`}
        subtitle="ابحثي عن أي منتج من أي قسم وارفعي صورته — بالملف أو برابط مباشرة. تتربط فيه فوراً."
      >
        <ProductPhotoUploader products={activeProducts} />
      </CollapsibleSection>

      <CollapsibleSection
        title={`شعارات الأقسام (${catalog.categories.length})`}
        subtitle="صورة القسم نفسه (تظهر بدل الإيموجي بالشاشة الرئيسية) — مثل شعار المطاحن والتموين."
      >
        <CategoryPhotoUploader categories={catalog.categories} />
      </CollapsibleSection>

      <CollapsibleSection title="تصفح حسب القسم" subtitle="اختاري قسم لعرض كل منتجاته — ارفعي صورة أو احذفي أو أضيفي منتج.">
        <CatalogManager categories={catalog.categories} products={catalog.products} />
      </CollapsibleSection>
    </main>
  );
}
