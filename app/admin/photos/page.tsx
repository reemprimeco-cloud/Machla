import Link from "next/link";

import { PhotoUploadRow } from "@/components/admin/PhotoUploadRow";
import { requireAdminAccess } from "@/lib/admin/guard";
import { getUploadedImagePaths } from "@/lib/admin/queries";

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
  { path: "biscuits_kfm_lemon_sandwich.webp", label: "بسكويت ليمون ساندوتش — مطاحن الكويت (KFM)" },
  { path: "kfm_logo.webp", label: "شعار قسم المطاحن الكويتية (KFM)" },
  { path: "tamween_logo.webp", label: "شعار قسم التموين (وزارة التجارة والصناعة)" },
];

export default async function AdminPhotosPage() {
  await requireAdminAccess();
  const uploaded = await getUploadedImagePaths(PENDING.map((p) => p.path));

  return (
    <main dir="rtl" className="mx-auto flex min-h-full w-full max-w-lg flex-col gap-4 bg-bg px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="hl-title text-ink">رفع صور المنتجات</h1>
        <Link href="/admin" className="hl-label text-primary underline">
          رجوع
        </Link>
      </div>
      <p className="hl-caption text-ink-muted">
        اختاري الصورة من جهازك لكل صنف واضغطي &quot;رفع&quot; — تنزل مباشرة لمخزن الكتالوج وتظهر بالتطبيق فوراً.
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
    </main>
  );
}
