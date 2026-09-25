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
 * Same destination as uploadCatalogImageAction, but the source is a URL
 * the owner pastes in (e.g. a Google Photos/Drive direct-image link)
 * instead of a file from her device — she asked for this so she doesn't
 * have to save each photo locally before uploading it. Fetches the URL
 * server-side on Vercel and re-uploads the bytes; admin-gated the same
 * as every other action here, so this isn't an open image-fetch proxy.
 */
export async function uploadCatalogImageFromUrlAction(
  path: string,
  imageUrl: string,
): Promise<UploadCatalogImageResult> {
  await requireAdminAccess();

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return { ok: false, message: "الرابط غير صحيح." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "الرابط غير صحيح." };
  }

  let response: Response;
  try {
    response = await fetch(parsed, { redirect: "follow" });
  } catch {
    return { ok: false, message: "تعذر تحميل الصورة من الرابط." };
  }
  if (!response.ok) {
    return { ok: false, message: `تعذر تحميل الصورة (${response.status}).` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return { ok: false, message: "الرابط لا يشير إلى صورة." };
  }

  const buffer = await response.arrayBuffer();
  const maxBytes = 15 * 1024 * 1024;
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    return { ok: false, message: "حجم الصورة غير مناسب." };
  }

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, buffer, { upsert: true, contentType });

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

/** uploadProductImageAction, but sourced from a pasted URL — see
 * uploadCatalogImageFromUrlAction for the fetch/validation details. */
export async function uploadProductImageFromUrlAction(
  productId: string,
  imageUrl: string,
): Promise<UploadCatalogImageResult> {
  await requireAdminAccess();

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return { ok: false, message: "الرابط غير صحيح." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, message: "الرابط غير صحيح." };
  }

  let response: Response;
  try {
    response = await fetch(parsed, { redirect: "follow" });
  } catch {
    return { ok: false, message: "تعذر تحميل الصورة من الرابط." };
  }
  if (!response.ok) {
    return { ok: false, message: `تعذر تحميل الصورة (${response.status}).` };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return { ok: false, message: "الرابط لا يشير إلى صورة." };
  }

  const buffer = await response.arrayBuffer();
  const maxBytes = 15 * 1024 * 1024;
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    return { ok: false, message: "حجم الصورة غير مناسب." };
  }

  const supabase = await createClient();
  const path = `product_${productId}.webp`;
  const { error: uploadError } = await supabase.storage
    .from("product-images")
    .upload(path, buffer, { upsert: true, contentType });
  if (uploadError) return { ok: false, message: uploadError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("product-images").getPublicUrl(path);

  const { error: updateError } = await supabase.rpc("admin_update_product_image", {
    p_product_id: productId,
    p_image_url: publicUrl,
  });
  if (updateError) return { ok: false, message: updateError.message };

  revalidatePath("/admin/photos");
  return { ok: true };
}

export type SimpleActionResult = { ok: true } | { ok: false; message: string };

/** Deactivate/reactivate a product — the catalog browsing/list
 * ("١ رز ١ دجاج كامل ١ صدرو دجاج") cleanup, from the UI instead of a
 * one-off SQL migration. Soft delete only: same is_active flag
 * getProductsInCategory already filters on, never a hard DELETE, since
 * shopping_list_items/product_usage_stats FK to products.id. */
export async function setProductActiveAction(
  productId: string,
  isActive: boolean,
): Promise<SimpleActionResult> {
  await requireAdminAccess();

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_product_active", {
    p_product_id: productId,
    p_is_active: isActive,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/photos");
  return { ok: true };
}

/** Add a new product to a category from the admin UI — the quick,
 * type-a-name-and-go counterpart to the bulk migration-based imports
 * (Tamween, KFM, ...). Only Arabic/English names are hers to type; the
 * other nine language columns fall back to the English string via
 * admin_create_product itself. */
export async function createProductAction(input: {
  categoryId: string;
  nameAr: string;
  nameEn: string;
  brand: string;
  icon: string;
  unit: string;
}): Promise<SimpleActionResult> {
  await requireAdminAccess();

  if (!input.nameAr.trim() || !input.nameEn.trim()) {
    return { ok: false, message: "اكتبي اسم المنتج بالعربي والإنجليزي." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_product", {
    p_category_id: input.categoryId,
    p_name_ar: input.nameAr.trim(),
    p_name_en: input.nameEn.trim(),
    p_brand: input.brand.trim() || null,
    p_icon: input.icon.trim() || null,
    p_unit: input.unit,
  });
  if (error) return { ok: false, message: error.message };

  revalidatePath("/admin/photos");
  return { ok: true };
}
