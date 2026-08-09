# Catalogue import

The offline pipeline that populates `public.categories` and
`public.products`. It is **not** part of the deployed app: refreshing the
catalogue must never require a UI change or a redeploy, and this is the
only code in the repo that touches the Supabase **service role** key.

Architecture and rationale: `docs/architecture/11-product-catalog-architecture.md` §7.

## Layout

```text
data/
├── categories.json      15 categories  × 9 languages
├── product-types.json   168 types      × 9 languages + search aliases
└── products.json        295 products   = type + brand + size
scripts/
├── build-catalog.mjs    validate + assemble
└── import.mjs           upsert into Supabase
```

Names live on the **type**, not the product. A product is a type plus a
brand and a size (`Almarai` + `1 L`), so adding a variant costs one line
and **zero** new translations, and every variant of a type stays
consistent by construction.

## Usage

Validate the curated data (no database, no dependencies needed):

```bash
node scripts/build-catalog.mjs --validate
node scripts/import.mjs --dry-run
```

Write to Supabase:

```bash
npm install            # only needed for a real import
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
node scripts/import.mjs
```

`build-catalog.mjs` is deliberately dependency-free so validation works in
a clean checkout and in CI; `@supabase/supabase-js` is imported lazily by
`import.mjs`, only once a real write is about to happen.

## Rules the validator enforces

The import **fails**, rather than warns, on any of these:

- a field named `price` / `cost` / `amount` / `kwd` / `currency` — prices
  are rejected at the door, never imported and filtered later;
- a missing translation in any of the nine languages;
- an unknown category or type reference, or an invalid unit;
- a duplicate natural key;
- a duplicate `sort_order` — a tie would make the worker's category
  grouping depend on the query planner, so the same list could render in
  two different orders on two devices.

## Re-running is safe

Categories upsert on `key`, products on `natural_key`
(`"<type>|<brand>|<size>"`, lowercased), so re-running after editing the
source files updates rows in place rather than duplicating them.

Products removed from the source files are **deactivated, never
deleted**: `shopping_list_items` reference products, and historical lists
must keep resolving.

## Provenance — read before trusting this data

The entries in `data/products.json` were **authored from general
knowledge** of what Kuwaiti supermarkets commonly stock. They were **not
scraped** and are **not verified against live inventory** — see the
`_provenance` block at the top of that file.

No request was ever made to Sharq Coop or Deliveroo Kuwait. Accordingly
`source_name` is `null` on every row (no row claims a source it does not
have) and `image_url` is `null` (the UI falls back to the category icon).

The nine-language translations have **not** had native-speaker review.
Telugu, Sinhala and Nepali are the most likely to need correction. Fixing
either the product list or a translation is an edit to `data/*.json`
followed by a re-run — no code change, no redeploy, no migration.
