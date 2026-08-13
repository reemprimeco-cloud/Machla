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

---

## 7. Phase 5 — as built

Phase 5 is implemented. The shape below is what actually shipped; where it
differs from the Phase 0 proposal above, this section is authoritative.

### 7.1 Sourcing — what was and was not done

The reference-source policy in §2 was honoured in the strictest available
reading: **no request was ever made to Sharq Coop or Deliveroo Kuwait**,
automated or otherwise, so there was nothing to bypass and no `robots.txt`
to comply with beyond not fetching at all.

The catalogue was instead **authored from general knowledge** of what is
commonly sold in Kuwaiti supermarkets. That is recorded in-band, in the
`_provenance` block at the top of `catalog-import/data/products.json`, so
nobody downstream mistakes it for verified inventory:

- entries are **not scraped** and **not verified against live inventory**;
- `source_name` is `null` on every row — no row claims a source it does
  not have;
- `image_url` is `null` on every row (see §7.5);
- **no prices**, in any form.

This is a deliberate trade: the catalogue is legally clean and immediately
usable, but its accuracy against any particular store is unverified. A
human curation pass against real shelves is the intended follow-up, and
the pipeline is built so that pass is a data edit, not a code change.

### 7.2 The type/brand split

The Phase 0 proposal implied one localized record per product. With nine
languages and ~300 products that is ~2,700 hand-written translations, and
every new size or brand variant would have added nine more — the failure
mode flagged in `14-technical-risks-decisions.md` item 13.

The data is therefore split in two:

```text
catalog-import/
├── data/
│   ├── categories.json      15 categories  × 9 languages
│   ├── product-types.json   168 types      × 9 languages + search aliases
│   └── products.json        295 products   = type + brand + size (no names)
└── scripts/
    ├── build-catalog.mjs    validate + assemble (no dependencies)
    └── import.mjs           upsert into Supabase (service role)
```

A **type** carries the localized vocabulary ("Fresh Milk" in nine
languages) and the search aliases. A **product** is a type plus a brand
and a size — `Almarai 1 L` — and carries no translations of its own.
Adding *Nadec 1 L* is a one-line change with zero new translation work,
and the nine names stay consistent across every variant of a type by
construction. 168 translated types cover 295 products.

### 7.3 Validation

`build-catalog.mjs` is dependency-free (deliberately: validating the
curated data must never require a database client, so `--dry-run` works in
CI and in a clean checkout). It refuses to emit a catalogue that has:

- any field named `price`/`cost`/`amount`/`kwd`/`currency` — prices are
  rejected at the door, not filtered later;
- a missing translation in any of the nine languages;
- an unknown category or type reference, or an invalid unit;
- a duplicate natural key;
- a duplicate `sort_order` (see §7.6).

### 7.4 Idempotent import

`natural_key` is `"<type>|<brand>|<size>"`, lowercased. The importer
upserts on it, so re-running after editing the source files updates rows
in place instead of duplicating them.

The unique index behind it is deliberately **not partial**. A
`where natural_key is not null` predicate would be redundant — Postgres
already treats NULLs as distinct in a unique index — and it would break
the importer outright: PostgREST's `on_conflict=natural_key` emits
`on conflict (natural_key)` with no index predicate, and Postgres refuses
to infer a partial index from that. `03_phase5_catalog_test.sql` asserts
the index stays total.

Products dropped from the source files are **deactivated, never deleted**:
`shopping_list_items` reference products, and historical lists must keep
resolving (`13-shopping-list-grouping-checklist.md` §4).

### 7.5 Images

Two separate things, deliberately kept apart:

**`products.icon` — always present.** A glyph per product *type* (168 of
them, 98 distinct), carried in `product-types.json` and written by the
importer. This exists because the first cut fell back to the *category*
icon, which meant all 24 items in Fruits & Vegetables rendered as the same
🥬 — a picture that carries no information is worse than no picture, and
this app's whole premise is navigating without reading. That category now
shows 20 distinct glyphs.

The validator warns when a category of four or more types collapses to
fewer than half as many distinct icons; it caught `rice_pasta_grains`
sharing five glyphs across twelve types on the first run.

Icons repeat where repeating is honest — there is one sensible glyph for
cheese and three cheese types — and glyphs are chosen from long-
established Unicode (mostly ≤ 12.0, 2019) so they render on the low-end
Android phones this app targets rather than as tofu boxes.

**`image_url` — a real photograph, when one has been licensed.** Still
null for every row. The UI falls back `image_url → icon → category icon`,
so a row without a photograph is a complete row, not a broken one. That
matters because sourcing 168 photographs is a content project measured in
weeks and the app has to be usable throughout.

The pipeline for it is built: `catalog-import/scripts/upload-images.mjs`
uploads to a `product-images` Supabase Storage bucket and points the
matching rows at the public URL. Files are named after the **type**
(`milk_fresh.webp`), so 168 files cover 295 products and a new brand needs
no new photograph; a single product can be overridden by natural key.
Adding a photograph is a data operation — no UI change, no redeploy, no
migration, which is the property §7 exists to protect.

**Where images may come from.** Licensed stock (the project has a
Shutterstock account), own photography, or images whose rights holder has
given written permission. Not from an image search, and **not** from
Sharq Coop or Deliveroo Kuwait — §2 designates those reference-only, and
their product photography belongs to them or their suppliers. Two
licence details worth checking before bulk-uploading: cheaper stock tiers
cap total impressions, and most forbid redistributing an image as a
standalone downloadable file, which is a live consideration because the
bucket is public-read (it backs a world-readable catalogue, and signing
every URL would cost a round trip per tile for no privacy gain). Upload
web-sized derivatives, not originals; the bucket caps objects at 2 MB and
the grid renders them at about 200px.

### 7.6 Deterministic grouping

Section 16A groups the worker's list by category and walks it in aisle
order. A tie in `sort_order` would make that order depend on the query
planner — the same list could render in two different orders on two
devices. Both the validator and `03_phase5_catalog_test.sql` therefore
assert `sort_order` is unique among active categories.

### 7.7 Search

`search_products(p_query text, p_limit int)` is the single read path.

- **`search_text`** concatenates every localized name (the nine required
  ones, plus `name_am`/`name_fr`/`name_fon` where a row has them —
  20260812180000_catalog_12_languages.sql), the brand, the size, and the
  search aliases, lowercased, into one haystack. A product translated
  into French has to be findable *in* French, or translating it achieved
  nothing; `concat_ws` skips the nulls, so untranslated rows are
  unaffected. It is
  maintained by a `before insert or update` **trigger**, not a generated
  column: a generated column requires every expression to be IMMUTABLE,
  which would rule out `unaccent` (only STABLE) later. The trigger gives
  the same "cannot drift from the row" guarantee with no such ceiling.
- **Every language is searched at once**, not just the caller's. A worker
  who types `gatas` (Filipino), `doodh` (Hindi), `حليب` (Arabic), or
  `Almarai` (brand) reaches the same row whatever their UI language —
  master plan Section 20.
- **Ranking** prefers a prefix match, then a word-boundary match, then any
  substring, then trigram similarity.
- `p_limit` is clamped into `[1, 200]` inside the function, so a hostile
  or accidental value cannot turn one search into a full-table dump.
- Inactive products are excluded; an empty, blank, or null query returns
  nothing rather than the whole catalogue.

`search_products` is **SECURITY INVOKER**, unlike the Phase 4 household
RPCs. The catalogue's RLS policy is `using (true)`, so definer rights
would unlock nothing and would only add another privileged surface.

### 7.8 Security posture

- `categories` and `products` are **world-readable, client-unwritable**:
  a `SELECT` policy of `using (true)` and *no* INSERT/UPDATE/DELETE policy
  at all. The offline importer running as `service_role` is the only write
  path. `03_phase5_catalog_test.sql` asserts anon and authenticated can
  read, cannot insert (raises), and cannot update or delete (silent no-op
  under RLS — so the test asserts the data is *unchanged*, which is the
  stronger property).
- `search_products` is executable by `authenticated` only; anon has
  EXECUTE on nothing, per `10-security-model.md` §5B.
- `products_refresh_search_text()` is trigger-only and executable by
  neither role.
- **`pg_trgm` is installed into `extensions`, not `public`.** An extension
  in `public` ships its functions into the schema PostgREST exposes, and
  extension functions carry EXECUTE for PUBLIC — so `similarity()` and
  friends would have been callable over `/rest/v1/rpc/` by anon. This is
  also what Supabase's own database linter flags
  (`extension_in_public`). `search_products` carries
  `set search_path = public, extensions` because the `%` operator and
  `similarity()` now resolve there.

### 7.9 Known-open Supabase advisor warnings

`get_advisors(type: "security")` reports seven
`authenticated_security_definer_function_executable` warnings, one per
Phase 4 household RPC. These are **expected and by design**: each of those
functions performs its own `auth.uid()` check internally, which is exactly
the pattern `10-security-model.md` §5 prescribes. They are not defects and
are not to be "fixed" by revoking EXECUTE — that would break the app.
