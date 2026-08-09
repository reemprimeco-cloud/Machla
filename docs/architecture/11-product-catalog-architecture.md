# 11 — Product Catalog / Import Architecture

## 1. Scope of Phase 0

Phase 0 defines this pipeline's architecture only. **No extraction, no
scraping, and no import runs in Phase 0** — that is Phase 5 work, and even
then only after the legal/technical checks below are actually performed
by a human.

## 2. Reference-source policy (Sharq Coop, Deliveroo Kuwait)

The task brief and master plan Section 5A are explicit and Phase 0 treats
them as hard constraints, not suggestions:

- Sharq Cooperative Society and Deliveroo Kuwait (Al Rawda & Hawally Coop)
  URLs are **reference sources only**.
- No anti-bot protection is to be bypassed.
- `robots.txt` and applicable site terms must be reviewed **before** any
  automated request is made against either site.
- **No prices are ever imported** — not filtered out post-import, simply
  never captured; the `products` table has no price column at all
  (`03-database-schema.md`).
- No automated checkout/order placement is ever built against these
  sites.
- Product images are not permanently re-hosted from these sites unless
  explicitly permitted; `image_url` is designed to be swappable
  independent of the metadata.

## 3. Recommended approach: human-curated import, not a scraper

Given the anti-bot and ToS uncertainty, Phase 0 recommends the Phase 5
catalog be populated via a **human-curated reference pass**, not an
automated scraper:

1. A person browses the reference sites (or others) in a normal browser
   and manually notes: product name (translated/localized as needed),
   brand, size, category, and the reference page URL — never the price.
2. That data is entered into a plain CSV/JSON file under
   `catalog-import/` following the `products` table shape (minus
   generated columns).
3. Product images are either (a) an internally produced/owned photo, (b)
   a licensed/stock image cleared for use, or (c) omitted, in which case
   the UI falls back to the product's **category icon** as a placeholder
   until a real image is sourced.
4. `image_source_url` records the reference page (traceability/attribution
   for where the metadata came from), and `source_name` records which
   source (`"Sharq Coop"`, `"Deliveroo Kuwait"`, `"internal"`, etc.) —
   distinct from `image_url`, which points to wherever the actually-used
   image is hosted (Supabase Storage for owned/licensed images).

This is flagged as a decision requiring your confirmation
(`14-technical-risks-decisions.md` item 6) since it affects how much
manual curation effort Phase 5 requires versus a (legally riskier)
automated approach. If a legitimate API or a data-sharing agreement with
either source becomes available later, the import pipeline's *input*
changes (CSV → API response) but its *output contract* into `products`
does not.

## 4. Import pipeline shape (Phase 5)

```text
catalog-import/
├── sources/
│   ├── sharq-coop.csv           (or .json)
│   └── deliveroo-kuwait.csv
├── categories.csv               (the 15 V1 categories, localized)
└── scripts/
    └── import.ts                (Node script, run manually / via a
                                    one-off Supabase Edge Function —
                                    NOT part of the running Next.js app)
```

The import script:

- Runs **offline**, using the Supabase **service role** key (never
  exposed to the browser — see `10-security-model.md` §6).
- Upserts on a natural key (e.g. `brand + name_en + size`) so re-running
  it is idempotent and safe to repeat as the curated source files are
  refined.
- Writes `category_id` by looking up `categories.key`, so category
  seeding must run before product import.
- Never writes a price field (none exists to write to).
- Is entirely separate from the deployed application — refreshing or
  replacing the catalog never requires a UI code change or app
  redeployment, just a re-run of the script.

## 5. Search index

Search (master plan Section 20) is database-backed: a `pg_trgm`/
`unaccent`-based index over the localized name columns actually used, plus
the `search_keywords text[]` column for aliases/transliterations (e.g.
`gatas` → Milk). This is finalized as part of Phase 5 once real product
data exists to test against; the column already exists in the Phase 0
schema proposal so Phase 5 doesn't need a schema change to add it.

## 6. Explicit non-goals

- No live/on-demand scraping at request time — the app never calls out to
  Sharq or Deliveroo directly.
- No price data anywhere in the system.
- No automated re-hosting of third-party images without a permission
  check having been done first.
- No AI-based product categorization/tagging in V1 (categories are
  assigned during curation, by a human).
