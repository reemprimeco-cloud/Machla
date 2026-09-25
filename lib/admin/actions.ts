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

/**
 * Uploads a photo for one specific product (any category, not just the
 * hand-typed PENDING list) and points that product's own image_url at
 * it — the general-purpose version of uploadCatalogImageAction, for
 * "upload a photo for this particular item" rather than "upload this
 * exact fixed file". Storage path is keyed by product id so re-uploading
 * for the same product overwrites its own file rather than colliding
 * with another product's.
 */
export async function uploadProductImageAction(
  productId: string,
  formData: FormData,
): Promise<UploadCatalogImageResult> {
  await requireAdminAccess();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "No file selected." };
  }

  const supabase = await createClient();
  const path = `product_${productId}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, file, { upsert: true, contentType: file.type || "image/webp" });
  if (uploadError) return { ok: false, message: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);

  // products only grants SELECT via RLS — this RPC is the write path
  // (20260925123000_admin_update_product_image.sql), same shape as
  // every other write in this schema.
  const { error: updateError } = await supabase.rpc("admin_update_product_image", {
    p_product_id: productId,
    p_image_url: publicUrl,
  });
  if (updateError) return { ok: false, message: updateError.message };

  revalidatePath("/admin/photos");
  return { ok: true };
}
