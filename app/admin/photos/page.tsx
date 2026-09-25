import Link from "next/link";

import { PhotoUploadRow } from "@/components/admin/PhotoUploadRow";
import { ProductPhotoUploader } from "@/components/admin/ProductPhotoUploader";
import { requireAdminAccess } from "@/lib/admin/guard";
import { getCategoryProductsForUpload, getUploadedImagePaths } from "@/lib/admin/queries";

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
  const [uploaded, tamweenProducts, kfmProducts] = await Promise.all([
    getUploadedImagePaths(PENDING.map((p) => p.path)),
    getCategoryProductsForUpload("tamween"),
    getCategoryProductsForUpload("kfm"),
  ]);

  return (
    <main dir="rtl" className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-6 bg-bg px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="hl-title text-ink">رفع صور المنتجات</h1>
        <Link href="/admin" className="hl-label text-primary underline">
          رجوع
        </Link>
      </div>

      {PENDING.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="hl-label text-ink-muted">شعارات وصور جاهزها Claude</h2>
          <p className="hl-caption text-ink-muted">
            اختاري الصورة من جهازك لكل صنف واضغطي &quot;رفع&quot;.
          </p>
          <div className="flex flex-col gap-2">
            {PENDING.map((item) => (
              <PhotoUploadRow
                key={item.path}
                path={item.path}
                label={item.label}
                initiallyUploaded={uploaded.has(item.path)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="hl-label text-ink-muted">صور منتجات المطاحن ({kfmProducts.length})</h2>
        <p className="hl-caption text-ink-muted">
          لأي صنف جديد بقسم المطاحن — بالملف أو برابط مباشرة.
        </p>
        <ProductPhotoUploader products={kfmProducts} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="hl-label text-ink-muted">صور منتجات التموين ({tamweenProducts.length})</h2>
        <p className="hl-caption text-ink-muted">
          ارفعي صورة لأي صنف من الـ116 مباشرة — تتربط فيه فوراً، بدون ما تحتاجين ترسلينها بالمحادثة.
        </p>
        <ProductPhotoUploader products={tamweenProducts} />
      </section>
    </main>
  );
}
