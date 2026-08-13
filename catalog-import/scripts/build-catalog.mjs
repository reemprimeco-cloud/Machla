#!/usr/bin/env node
/**
 * Validates the curated catalogue files and resolves them into flat rows
 * ready for `categories` and `products`.
 *
 * Pure and database-free on purpose: `--validate` runs in CI or before a
 * commit with no Supabase project, no credentials, and no network. The
 * importer (import.mjs) consumes what this produces.
 *
 *   node catalog-import/scripts/build-catalog.mjs --validate
 *   node catalog-import/scripts/build-catalog.mjs --out build/catalog.json
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The nine names every catalogue row MUST carry — these columns are
 * NOT NULL in the database, and a row missing one fails the import. */
export const LANGS = ["en", "ar", "hi", "te", "ur", "fil", "ne", "id", "si"];

/** Added by 20260812180000_catalog_12_languages.sql, and deliberately
 * OPTIONAL: the columns are nullable, and `localizedName` falls back to
 * English for a row that has not been translated yet
 * (lib/catalog/localized.ts). That lets the catalogue be translated a
 * category at a time instead of requiring all 168 product types in three
 * more languages before any of it can ship. */
export const OPTIONAL_LANGS = ["am", "fr", "fon"];

/** Mirrors the products.unit CHECK constraint in the Phase 1 migration.
 * Kept in sync by hand; a mismatch fails the import rather than the
 * database, which is the friendlier place to find out. */
export const UNITS = ["pcs", "kg", "g", "l", "ml", "pack", "box", "bottle", "bag", "other"];

/** The products table has no price column. Anything price-shaped in the
 * source data is a curation mistake — the master plan forbids importing
 * prices, so fail loudly instead of silently dropping the field. */
const FORBIDDEN_FIELDS = ["price", "prices", "cost", "amount", "kwd", "currency"];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(ROOT, relativePath), "utf8"));
}

export function buildCatalog() {
  const errors = [];
  const warnings = [];

  const categoriesFile = readJson("data/categories.json");
  const typesFile = readJson("data/product-types.json");
  const productsFile = readJson("data/products.json");

  // ---- categories ------------------------------------------------
  const categories = [];
  const categoryKeys = new Set();
  const sortOrders = new Map();

  for (const category of categoriesFile.categories) {
    if (categoryKeys.has(category.key)) errors.push(`duplicate category key: ${category.key}`);
    categoryKeys.add(category.key);

    if (sortOrders.has(category.sort_order)) {
      // Two categories sharing a sort_order makes the household-side
      // grouping order non-deterministic, which is the one property
      // Section 16A actually guarantees.
      errors.push(
        `sort_order ${category.sort_order} used by both ${sortOrders.get(category.sort_order)} and ${category.key}`,
      );
    }
    sortOrders.set(category.sort_order, category.key);

    for (const lang of LANGS) {
      if (!category.names?.[lang]?.trim()) errors.push(`category ${category.key}: missing name.${lang}`);
    }

    categories.push({
      key: category.key,
      icon: category.icon ?? null,
      sort_order: category.sort_order,
      is_active: true,
      ...Object.fromEntries(LANGS.map((lang) => [`name_${lang}`, category.names?.[lang] ?? ""])),
      ...Object.fromEntries(
        OPTIONAL_LANGS.map((lang) => [`name_${lang}`, category.names?.[lang]?.trim() || null]),
      ),
    });
  }

  // ---- types -----------------------------------------------------
  const typesByKey = new Map();
  for (const type of typesFile.types) {
    if (typesByKey.has(type.key)) errors.push(`duplicate type key: ${type.key}`);
    if (!categoryKeys.has(type.category)) errors.push(`type ${type.key}: unknown category ${type.category}`);
    if (!UNITS.includes(type.unit)) errors.push(`type ${type.key}: invalid unit "${type.unit}"`);
    // Every type carries its own icon. Without one the product grid falls
    // back to the category icon, which means all 24 items in Fruits &
    // Vegetables render as the same glyph — unusable for a shopper who is
    // navigating by picture rather than by text.
    if (!type.icon?.trim()) errors.push(`type ${type.key}: missing icon`);
    for (const lang of LANGS) {
      if (!type.names?.[lang]?.trim()) errors.push(`type ${type.key}: missing name.${lang}`);
    }
    typesByKey.set(type.key, type);
  }

  // ---- products --------------------------------------------------
  const products = [];
  const naturalKeys = new Set();
  const usedTypes = new Set();

  productsFile.products.forEach((product, index) => {
    const where = `products[${index}] (${product.type ?? "?"}${product.brand ? ` / ${product.brand}` : ""})`;

    for (const field of FORBIDDEN_FIELDS) {
      if (field in product) errors.push(`${where}: forbidden field "${field}" — prices are never imported`);
    }

    const type = typesByKey.get(product.type);
    if (!type) {
      errors.push(`${where}: unknown type "${product.type}"`);
      return;
    }
    usedTypes.add(product.type);

    const unit = product.unit ?? type.unit;
    if (!UNITS.includes(unit)) errors.push(`${where}: invalid unit "${unit}"`);

    // Natural key for idempotent upsert. Deliberately not the product id:
    // re-running the import must update the same row rather than insert a
    // duplicate, and ids are generated by the database.
    const naturalKey = [product.type, product.brand ?? "", product.size ?? ""]
      .map((part) => String(part).trim().toLowerCase())
      .join("|");
    if (naturalKeys.has(naturalKey)) {
      errors.push(`${where}: duplicate product (same type + brand + size)`);
    }
    naturalKeys.add(naturalKey);

    // Search keywords: the type's aliases plus the brand, so both
    // "gatas" and "Almarai" find the same row (master plan Section 20).
    const keywords = new Set((type.keywords ?? []).map((k) => k.toLowerCase()));
    if (product.brand) keywords.add(product.brand.toLowerCase());
    keywords.add(type.names.en.toLowerCase());

    products.push({
      natural_key: naturalKey,
      category_key: type.category,
      // The icon lives on the TYPE, so every brand and size of a product
      // shares one — the same reason the nine names do
      // (11-product-catalog-architecture.md §7.2). A product-level
      // override is honoured if the source file sets one.
      icon: product.icon ?? type.icon,
      brand: product.brand ?? null,
      size: product.size ?? null,
      unit,
      image_url: product.image_url ?? null,
      image_source_url: product.image_source_url ?? null,
      source_name: product.source_name ?? null,
      barcode: product.barcode ?? null,
      sku: product.sku ?? null,
      search_keywords: [...keywords].sort(),
      is_active: true,
      sort_order: index,
      ...Object.fromEntries(LANGS.map((lang) => [`name_${lang}`, type.names[lang]])),
      ...Object.fromEntries(
        OPTIONAL_LANGS.map((lang) => [`name_${lang}`, type.names[lang]?.trim() || null]),
      ),
    });
  });

  for (const key of typesByKey.keys()) {
    if (!usedTypes.has(key)) warnings.push(`type "${key}" is defined but no product uses it`);
  }

  // Icons are allowed to repeat — there is one sensible glyph for cheese
  // and three cheese types. But if a whole category collapses to a couple
  // of glyphs, the picture stops carrying information and the shopper is
  // back to reading, which is the thing this app exists to avoid.
  const iconsPerCategory = new Map();
  for (const type of typesByKey.values()) {
    const entry = iconsPerCategory.get(type.category) ?? { icons: new Set(), count: 0 };
    entry.icons.add(type.icon);
    entry.count += 1;
    iconsPerCategory.set(type.category, entry);
  }
  for (const [category, { icons, count }] of iconsPerCategory) {
    if (count >= 4 && icons.size < count / 2) {
      warnings.push(
        `category "${category}" has ${count} types sharing only ${icons.size} distinct icons — ` +
          `the grid will look repetitive`,
      );
    }
  }

  const emptyCategories = [...categoryKeys].filter(
    (key) => !products.some((product) => product.category_key === key),
  );
  for (const key of emptyCategories) warnings.push(`category "${key}" has no products`);

  return { categories, products, errors, warnings };
}

// ---- CLI ---------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const { categories, products, errors, warnings } = buildCatalog();

  for (const warning of warnings) console.warn(`warning: ${warning}`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} error(s):`);
    for (const error of errors) console.error(`  ${error}`);
    process.exit(1);
  }

  const byCategory = new Map();
  for (const product of products) {
    byCategory.set(product.category_key, (byCategory.get(product.category_key) ?? 0) + 1);
  }

  console.log(`categories: ${categories.length}`);
  console.log(`products:   ${products.length}`);
  console.log(`languages:  ${LANGS.length} required (${LANGS.join(", ")})`);
  console.log(`            ${OPTIONAL_LANGS.length} optional (${OPTIONAL_LANGS.join(", ")})`);
  console.log("\nproducts per category:");
  for (const category of categories) {
    console.log(`  ${String(category.sort_order).padStart(2)} ${category.key.padEnd(20)} ${byCategory.get(category.key) ?? 0}`);
  }

  const outIndex = process.argv.indexOf("--out");
  if (outIndex !== -1 && process.argv[outIndex + 1]) {
    const outPath = path.resolve(process.argv[outIndex + 1]);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify({ categories, products }, null, 2));
    console.log(`\nwrote ${outPath}`);
  }

  console.log("\nvalidation OK");
}
