#!/usr/bin/env node
/**
 * Uploads licensed product photography to Supabase Storage and points the
 * catalogue at it.
 *
 * Runs OFFLINE, like the rest of catalog-import/. Adding or replacing a
 * photograph is a data operation: drop a file in, re-run this, done. No UI
 * change, no redeploy, no migration.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node catalog-import/scripts/upload-images.mjs [--dry-run]
 *
 * ---------------------------------------------------------------------
 * WHERE THE FILES COME FROM — read this before adding any
 * ---------------------------------------------------------------------
 * Only images you hold a licence for. In practice that means:
 *
 *   * stock you have licensed (Shutterstock, Adobe Stock, …), within
 *     whatever that licence permits;
 *   * photographs you took yourself;
 *   * images the rights holder has given you written permission to use.
 *
 * NOT from a Google Images search, and NOT lifted from a retailer's site
 * — including Sharq Coop and Deliveroo Kuwait, which the project brief
 * designates reference-only and whose product photography belongs to them
 * or their suppliers (docs/architecture/11-product-catalog-architecture.md §2).
 *
 * Two practical notes on stock licences: they typically cap total
 * impressions on the cheaper tier, and they generally forbid
 * redistributing the image as a standalone downloadable file. The bucket
 * this uploads to is public-read, so keep originals out of it — this
 * script uploads a web-sized derivative only.
 *
 * ---------------------------------------------------------------------
 * LAYOUT
 * ---------------------------------------------------------------------
 * Files are named after the PRODUCT TYPE, not the product:
 *
 *   catalog-import/images/
 *   ├── milk_fresh.webp        → every milk_fresh product, any brand/size
 *   ├── tomato.webp
 *   └── basmati_rice.jpg
 *
 * That is the same split the names use (§7.2): 168 files cover 295
 * products, and adding a new brand needs no new photograph. A single
 * product can still be overridden by naming the file after its natural
 * key with `|` replaced by `~`, e.g.
 * `milk_fresh~almarai~1 l.webp`.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildCatalog } from "./build-catalog.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMAGE_DIR = path.join(ROOT, "images");
const BUCKET = "product-images";
const ACCEPTED = new Set([".webp", ".jpg", ".jpeg", ".png"]);
const MAX_BYTES = 2 * 1024 * 1024;

const DRY_RUN = process.argv.includes("--dry-run");
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// ---- work out what maps to what ------------------------------------

const { products, errors } = buildCatalog();
if (errors.length > 0) fail(`catalogue is invalid; fix that first (${errors.length} error(s))`);

if (!existsSync(IMAGE_DIR)) {
  console.log(`no images directory at ${IMAGE_DIR} — nothing to upload`);
  console.log("create it and drop <type_key>.webp files in; see the header of this file");
  process.exit(0);
}

// Three places, one flat namespace, split by who owns the image —
// catalog-import/images/.gitignore explains which are committed and why.
// Applied in ascending order of deliberateness, so the later one wins on
// a filename collision: generated artwork is the fallback, a real
// photograph beats it, and anything dropped in the root beats both.
const GENERATED_DIR = path.join(IMAGE_DIR, "generated");
const OWNED_DIR = path.join(IMAGE_DIR, "owned");

function imagesIn(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => ACCEPTED.has(path.extname(name).toLowerCase()));
}

const dirByFile = new Map(); // filename -> directory to read it from
for (const dir of [GENERATED_DIR, OWNED_DIR, IMAGE_DIR]) {
  for (const name of imagesIn(dir)) dirByFile.set(name, dir);
}

const files = [...dirByFile.keys()];

// natural_key is "<type>|<brand>|<size>"; the type is the part before the
// first pipe, which is what a type-level file is named after.
const productsByType = new Map();
for (const product of products) {
  const type = product.natural_key.split("|")[0];
  const bucket = productsByType.get(type);
  if (bucket) bucket.push(product);
  else productsByType.set(type, [product]);
}
const productsByNaturalKey = new Map(products.map((p) => [p.natural_key, p]));

const uploads = [];
const unmatched = [];

for (const file of files) {
  const stem = path.basename(file, path.extname(file));
  // `~` stands in for `|`, which is legal in a natural key but awkward in
  // a filename on some systems.
  const asNaturalKey = stem.replaceAll("~", "|");

  if (productsByNaturalKey.has(asNaturalKey)) {
    uploads.push({ file, targets: [productsByNaturalKey.get(asNaturalKey)], scope: "product" });
  } else if (productsByType.has(stem)) {
    uploads.push({ file, targets: productsByType.get(stem), scope: "type" });
  } else {
    unmatched.push(file);
  }
}

for (const file of unmatched) {
  console.warn(`warning: ${file} matches no product type or natural key — skipped`);
}

const covered = new Set(uploads.flatMap((u) => u.targets.map((t) => t.natural_key)));
console.log(
  `${files.length} image file(s); ${uploads.length} matched, covering ${covered.size}/${products.length} products`,
);

const typesWithout = [...productsByType.keys()].filter(
  (type) => !uploads.some((u) => u.scope === "type" && path.basename(u.file, path.extname(u.file)) === type),
);
if (typesWithout.length > 0) {
  console.log(
    `${typesWithout.length} type(s) still have no photograph and will show their icon; ` +
      `next up: ${typesWithout.slice(0, 8).join(", ")}${typesWithout.length > 8 ? "…" : ""}`,
  );
}

if (DRY_RUN) {
  console.log("dry run — nothing uploaded");
  process.exit(0);
}

if (!SUPABASE_URL) fail("SUPABASE_URL is not set");
if (!SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY is not set");

const { createClient } = await import("@supabase/supabase-js").catch(() =>
  fail("@supabase/supabase-js is not installed. Run `npm install` in catalog-import/ first."),
);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CONTENT_TYPES = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

let uploaded = 0;
let pointed = 0;

for (const { file, targets, scope } of uploads) {
  const body = readFileSync(path.join(dirByFile.get(file), file));

  // The bucket enforces this too, but failing here names the file rather
  // than surfacing an opaque storage error.
  if (body.byteLength > MAX_BYTES) {
    console.warn(
      `warning: ${file} is ${(body.byteLength / 1024 / 1024).toFixed(1)} MB, over the 2 MB limit — ` +
        `resize it (these render at about 200px) and re-run. Skipped.`,
    );
    continue;
  }

  const extension = path.extname(file).toLowerCase();
  const objectPath = `${path.basename(file, extension)}${extension}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(objectPath, body, {
    contentType: CONTENT_TYPES[extension],
    upsert: true,
  });

  if (uploadError) {
    console.warn(`warning: ${file} failed to upload: ${uploadError.message}`);
    continue;
  }
  uploaded += 1;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  const naturalKeys = targets.map((target) => target.natural_key);
  const { error: updateError } = await supabase
    .from("products")
    .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
    .in("natural_key", naturalKeys);

  if (updateError) {
    console.warn(`warning: uploaded ${file} but could not point products at it: ${updateError.message}`);
    continue;
  }

  pointed += naturalKeys.length;
  console.log(`  ${file} → ${naturalKeys.length} product(s) [${scope}]`);
}

console.log(`\nuploaded ${uploaded} image(s); ${pointed} product row(s) now have a photograph`);
