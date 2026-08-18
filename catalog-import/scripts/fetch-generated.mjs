#!/usr/bin/env node
/**
 * One-time helper: downloads freshly generated product images (from this
 * session's Higgsfield generations) into catalog-import/images/generated/,
 * converting them to the house style (400x400 webp) the rest of that
 * directory already uses.
 *
 * Run locally (needs real internet access — this cannot run inside a
 * sandboxed Claude Code session):
 *
 *   cd catalog-import && npm install sharp   # if not already present
 *   node scripts/fetch-generated.mjs
 *
 * Then upload with the existing pipeline:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/upload-images.mjs
 */

import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_DIR = path.join(ROOT, "images", "generated");

const IMAGES = {
  // "milk_chocolate" is deliberately not in this list: it was only ever a
  // style reference in conversation (the "cocoa carton" everyone agreed
  // on) — it isn't a real product type in product-types.json/products.json
  // and hasn't been added to the catalogue, unlike the 8 types below.
  apple_juice: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_090924_0c59d06a-243e-489f-9563-362475995444.png",
  mango_juice: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_090924_eb69a97f-5199-438c-8ad0-8ef51ec0264e.png",
  orange_juice: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_090924_0f76f0dc-fceb-4268-8c60-e95e22f84aec.png",
  milk_banana: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_091633_556cebe0-4959-49d9-a327-f94be257b5ea.png",
  milk_strawberry: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_091632_0e6f1b58-4df0-43c9-be74-ed7eaa8df3e0.png",
  fruit_cocktail_juice: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_091632_e38617d7-7036-4655-8c15-03b809fc9131.png",
  passion_fruit_juice: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_091633_99ed6b86-1df7-4544-b4d8-072fa13f49ec.png",
  blood_orange_juice: "https://d8j0ntlcm91z4.cloudfront.net/user_3AGhTHKPN3FQpd6GCElZeyNv3tQ/hf_20260818_091632_f7352a88-b46c-4df9-8ed4-ef2f531ebf2e.png",
};

mkdirSync(OUT_DIR, { recursive: true });

const { default: sharp } = await import("sharp").catch(() => {
  console.error("error: sharp is not installed. Run `npm install sharp` in catalog-import/ first.");
  process.exit(1);
});

for (const [type, url] of Object.entries(IMAGES)) {
  process.stdout.write(`${type} ... `);
  const res = await fetch(url);
  if (!res.ok) {
    console.log(`FAILED (${res.status})`);
    continue;
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${type}.webp`);
  await sharp(buffer)
    .resize(400, 400, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .webp({ quality: 82 })
    .toFile(outPath);
  console.log(`-> ${path.relative(ROOT, outPath)}`);
}

console.log("\ndone. Next: node scripts/upload-images.mjs --dry-run (then without --dry-run)");
