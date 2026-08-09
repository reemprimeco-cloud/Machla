#!/usr/bin/env node
/**
 * Imports the curated catalogue into Supabase.
 *
 * Runs OFFLINE — not part of the deployed app. It is the only thing that
 * writes to `categories` and `products`, and the only place the service
 * role key is used (docs/architecture/10-security-model.md §6,
 * 11-product-catalog-architecture.md). That key must never appear in
 * apps/web or in any NEXT_PUBLIC_* variable.
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
 *   node catalog-import/scripts/import.mjs [--dry-run]
 *
 * Idempotent: categories upsert on `key`, products on `natural_key`, so
 * re-running after editing the source files updates rows in place rather
 * than duplicating them. Refreshing the catalogue therefore never
 * requires a UI change or a redeploy.
 */

import { buildCatalog } from "./build-catalog.mjs";

// @supabase/supabase-js is imported lazily, below, only once a real write
// is about to happen. That keeps `--dry-run` (and therefore CI, and a
// pre-commit check) working with nothing installed — validation of the
// curated data should never depend on a database client.

const DRY_RUN = process.argv.includes("--dry-run");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

const { categories, products, errors, warnings } = buildCatalog();

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length > 0) {
  console.error(`${errors.length} validation error(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exit(1);
}

console.log(`validated ${categories.length} categories and ${products.length} products`);

if (DRY_RUN) {
  console.log("dry run — nothing written");
  process.exit(0);
}

if (!SUPABASE_URL) fail("SUPABASE_URL is not set");
if (!SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY is not set");
if (SERVICE_ROLE_KEY.length < 40) fail("SUPABASE_SERVICE_ROLE_KEY looks wrong");

const { createClient } = await import("@supabase/supabase-js").catch(() =>
  fail(
    "@supabase/supabase-js is not installed. Run `npm install` in catalog-import/ first " +
      "(it is intentionally separate from apps/web — see catalog-import/README.md).",
  ),
);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---- categories ---------------------------------------------------

const { data: upsertedCategories, error: categoryError } = await supabase
  .from("categories")
  .upsert(categories, { onConflict: "key" })
  .select("id, key");

if (categoryError) fail(`categories upsert failed: ${categoryError.message}`);

const categoryIdByKey = new Map(upsertedCategories.map((row) => [row.key, row.id]));
console.log(`upserted ${upsertedCategories.length} categories`);

// ---- products -----------------------------------------------------

// category_key is resolved here rather than stored, so the source files
// never carry a generated id.
const rows = products.map(({ category_key, ...product }) => {
  const categoryId = categoryIdByKey.get(category_key);
  if (!categoryId) fail(`no category id for "${category_key}"`);
  return { ...product, category_id: categoryId };
});

const CHUNK = 200;
let written = 0;

for (let i = 0; i < rows.length; i += CHUNK) {
  const chunk = rows.slice(i, i + CHUNK);
  const { error } = await supabase.from("products").upsert(chunk, { onConflict: "natural_key" });
  if (error) fail(`products upsert failed at row ${i}: ${error.message}`);
  written += chunk.length;
  console.log(`  products ${written}/${rows.length}`);
}

// Anything previously imported but no longer in the source files is
// deactivated rather than deleted: shopping_list_items reference
// products, and historical lists must keep resolving
// (docs/architecture/13-shopping-list-grouping-checklist.md §4).
const currentKeys = rows.map((row) => row.natural_key);
const { data: stale, error: staleError } = await supabase
  .from("products")
  .update({ is_active: false })
  .not("natural_key", "is", null)
  .not("natural_key", "in", `(${currentKeys.map((key) => `"${key}"`).join(",")})`)
  .select("id");

if (staleError) {
  console.warn(`warning: could not deactivate removed products: ${staleError.message}`);
} else if (stale?.length) {
  console.log(`deactivated ${stale.length} product(s) no longer in the source files`);
}

console.log(`\nimported ${written} products across ${upsertedCategories.length} categories`);
