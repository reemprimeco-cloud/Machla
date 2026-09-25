"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAccess } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

export type UploadCatalogImageResult = { ok: true } | { ok: false; message: string };

/**
 * Uploads one file straight into the public product-images bucket at an
 * exact path, for the admin-only /admin/photos screen. Runs server-side
 * on Vercel, not in a browser — the Claude-artifact uploader this
 * replaced ran client-side inside claude.ai's sandboxed iframe, whose
 * CSP silently blocks any fetch/XHR to a third-party origin like
 * Supabase (browsers report this as a bare "Load failed", not a CORS or
 * auth error — the request never left the page). A Server Action has no
 * such sandbox, and product_images_admin_insert/update
 * (20260925075343_product_images_admin_write.sql) already authorizes
 * this account's session to write here.
 */
export async function uploadCatalogImageAction(
  path: string,
  formData: FormData,
): Promise<UploadCatalogImageResult> {
  await requireAdminAccess();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No file selected." };
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type || "image/webp" });

  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/photos");
  return { ok: true };
}
