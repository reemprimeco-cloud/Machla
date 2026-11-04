/**
 * Client-side image downscaling for photographed items.
 *
 * No `server-only` here and no framework imports: this is deliberately
 * portable, because a native client has the same job to do before
 * uploading into the same bucket (`18-backend-contract.md` §6).
 */

/** Matches the bucket's file_size_limit in
 * `20260810140000_photo_items.sql`. Keeping the client's ceiling equal to
 * the server's means a rejection is explainable rather than mysterious. */
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;

/** Long edge in pixels. The picture is looked at on a phone, at roughly
 * thumbnail size in a checklist and full-width at most — 1280 is already
 * generous, and it is what keeps an upload viable on a slow connection. */
const MAX_EDGE = 1280;

const WEBP_QUALITY = 0.8;
const JPEG_QUALITY = 0.8;

/**
 * Re-encodes a camera photo as a bounded WebP, falling back to JPEG.
 *
 * Phone cameras routinely produce 4–8 MB, which the bucket rejects and
 * which would take an unpleasant amount of time to upload from a Kuwaiti
 * mobile connection. Doing this in the browser also means the raw
 * original never leaves the device.
 *
 * WebP first (2026-11-04 performance audit: ~25-35% smaller than JPEG at
 * the same visual quality, on exactly the low-end-Android-on-weak-wifi
 * connections this function exists for), JPEG as the fallback for a
 * browser whose `canvas.toBlob` cannot encode WebP — that call does not
 * throw or reject on an unsupported type, it silently hands back a PNG
 * instead, which at this resolution is often larger than the JPEG this
 * function is trying to beat. So the real feature-detection is "did we
 * actually get image/webp back", not a try/catch.
 *
 * Falls back to the original file if the browser cannot decode it at
 * all — the caller still enforces PHOTO_MAX_BYTES, so the failure mode
 * is a clear "too large" rather than a silent bad upload.
 */
export async function downscalePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const webpBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
  );
  if (webpBlob && webpBlob.type === "image/webp") {
    // Always photo.webp: the canvas re-encode makes the original
    // extension a lie, and the RPC's path check does not care what the
    // name is beyond it being non-empty and free of traversal.
    return new File([webpBlob], "photo.webp", { type: "image/webp" });
  }

  const jpegBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!jpegBlob) return file;

  return new File([jpegBlob], "photo.jpg", { type: "image/jpeg" });
}
