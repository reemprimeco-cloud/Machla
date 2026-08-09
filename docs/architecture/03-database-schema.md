# 03 — Database Schema Proposal

Postgres/Supabase. All tables use `uuid` primary keys
(`default gen_random_uuid()`), `timestamptz` timestamps, and
`created_at default now()`. This is a **proposal** for Phase 1 migrations —
no migration is applied in Phase 0.

## users

Mirrors `auth.users` 1:1 via a trigger (`handle_new_user`) that inserts a
row on first sign-in. `id` **is** `auth.users.id` (not a separate FK), so
`auth.uid() = users.id` everywhere.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| phone_number | text unique not null | E.164 format |
| role | text not null default 'worker' | `owner \| member \| worker` — **default persona only**, see `04-roles-permission-matrix.md` §2 for why this is not the authorization source of truth |
| preferred_language | text | one of the 9 language codes; nullable until onboarding completes |
| display_name | text | nullable, shown to household on lists |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

RLS: a user can `SELECT`/`UPDATE` only their own row
(`id = auth.uid()`). No user can list or search other users directly;
household-scoped visibility of other users happens only through
`household_members` (see `10-security-model.md`).

## households

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| name | text not null | e.g. "Reem's Home" |
| owner_user_id | uuid FK → users.id not null | denormalized convenience pointer, see ERD notes |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

No `public_code`/searchable slug is exposed — households are deliberately
not discoverable (master plan Section 15).

## household_members

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| household_id | uuid FK → households.id not null | |
| user_id | uuid FK → users.id not null | |
| role | text not null | `owner \| member \| worker` |
| status | text not null default 'active' | `active \| removed` (soft delete — preserves `created_by_user_id` references on historical lists) |
| invited_by_user_id | uuid FK → users.id | nullable (null for the owner's own creating row) |
| joined_at | timestamptz not null default now() | |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

Constraint: `unique (household_id, user_id)`.
Constraint: exactly one `active` row with `role='owner'` per household —
enforced with a partial unique index
`unique (household_id) where role='owner' and status='active'`.

Rows are **only** ever inserted by the `create_household` and
`accept_invitation` RPC functions, never by direct client `INSERT` — see
`10-security-model.md`.

## household_invitations

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| household_id | uuid FK → households.id not null | |
| code | text unique not null | 8-char Crockford base32, see `07-invitation-flow.md` |
| role | text not null | `member \| worker` — role granted on acceptance |
| status | text not null default 'pending' | `pending \| accepted \| revoked \| expired` |
| max_uses | int not null default 1 | V1 always 1 (single-use) |
| created_by_user_id | uuid FK → users.id not null | must be the household's owner |
| used_by_user_id | uuid FK → users.id | nullable |
| used_at | timestamptz | nullable |
| expires_at | timestamptz not null | default `now() + interval '7 days'` |
| created_at | timestamptz not null default now() | |

`code` is never derived from `household.id` (master plan Section 9).
Expiry is enforced both by an application check and a scheduled cleanup
(status flips to `expired`) — see `07-invitation-flow.md`.

## categories

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| key | text unique not null | stable slug, e.g. `fruits_vegetables` |
| icon | text | emoji or icon token, e.g. `🥬` |
| sort_order | int not null | drives the deterministic default category order (master plan Section 16A) |
| is_active | bool not null default true | |
| name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si | text not null | one per supported language |

Publicly readable (`select` to `anon`/`authenticated`); writes restricted
to the service role (import pipeline only).

## products

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| category_id | uuid FK → categories.id not null | |
| subcategory_id | uuid FK → categories.id | nullable, self-referential |
| brand | text | nullable |
| name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si | text not null | |
| size | text | e.g. `"2L"`, `"1kg"` |
| unit | text not null | see `unit_type` enum note below |
| image_url | text | nullable until sourced; defaults to a category icon placeholder in the UI when null |
| image_source_url | text | reference page the metadata was curated from (Sharq/Deliveroo/etc.) |
| source_name | text | e.g. `"Sharq Coop"`, `"Deliveroo Kuwait"`, `"internal"` |
| barcode | text | nullable, optional future field, included now for forward-compat |
| sku | text | nullable |
| search_keywords | text[] | aliases/transliterations, e.g. `{gatas}` → milk |
| is_active | bool not null default true | |
| sort_order | int not null default 0 | deterministic fallback order within a category |
| created_at, updated_at | timestamptz | |

No price column exists anywhere in the schema — not omitted by
convention, structurally absent (master plan rule: do not import prices).

Publicly readable; writes restricted to the service role (import
pipeline), consistent with `categories`.

**`unit` values (proposed enum, app-level validated in Phase 1, see
`14-technical-risks-decisions.md` item 8 for approval):**
`pcs | kg | g | l | ml | pack | box | bottle | bag | other`.

## product_usage_stats

Backs "My Usual Items" (master plan Section 19).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users.id not null | |
| product_id | uuid FK → products.id not null | |
| selection_count | int not null default 0 | |
| last_selected_at | timestamptz | |

Constraint: `unique (user_id, product_id)`. Incremented via a small RPC
(`record_product_selection`) called when a worker adds a product to a
draft list — avoids a client-writable counter.

## shopping_lists

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| household_id | uuid FK → households.id not null | |
| created_by_user_id | uuid FK → users.id not null | who built the list (worker or member) |
| status | text not null default 'draft' | `draft \| sent \| viewed \| completed \| archived` |
| language | text not null | the creator's language at send time (for record-keeping; display language is per-viewer, see `13-shopping-list-grouping-checklist.md`) |
| created_at | timestamptz not null default now() | |
| sent_at | timestamptz | nullable |
| viewed_at | timestamptz | nullable, first time an owner/member opens a `sent` list |
| completed_at | timestamptz | nullable |
| updated_at | timestamptz not null default now() | |

## shopping_list_items

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| list_id | uuid FK → shopping_lists.id not null | |
| product_id | uuid FK → products.id not null | |
| category_id | uuid FK → categories.id not null | **snapshot** of `products.category_id` at insert time — not re-derived at display time (master plan Section 16A.4) |
| quantity | numeric not null default 1 | supports fractional (e.g. `2` kg, `1.5` kg) |
| unit | text not null | copied from the product at add-time, editable by the creator while `draft` |
| note | text | nullable, free text (e.g. "any brand") |
| sort_order | int not null | worker's add order, for stable in-category ordering |
| purchase_status | text not null default 'pending' | `pending \| purchased \| unavailable` |
| purchased_at | timestamptz | nullable |
| purchased_by_user_id | uuid FK → users.id | nullable |
| created_at, updated_at | timestamptz | |

Two disjoint field groups, enforced as disjoint by RPC boundary (not just
convention — see `10-security-model.md`):

- **Requested fields** (`product_id, category_id, quantity, unit, note,
  sort_order`) — writable only by the list's creator, only while
  `shopping_lists.status = 'draft'`.
- **Purchase-execution fields** (`purchase_status, purchased_at,
  purchased_by_user_id`) — writable only by an active Owner/Member of the
  household, at any list status from `sent` onward, via a dedicated RPC
  that touches *only* these columns.

## Indexes (proposed)

- `household_members (household_id, status)`
- `household_members (user_id, status)`
- `household_invitations (code)` unique
- `household_invitations (household_id, status)`
- `shopping_lists (household_id, status, created_at desc)`
- `shopping_list_items (list_id, category_id, sort_order)`
- `products (category_id, is_active, sort_order)`
- `products` GIN index on `search_keywords` and a `pg_trgm`/`unaccent`
  index on the localized name columns actually used by search (finalized
  in Phase 5 once the search approach is implemented)

## Enums vs. text + check constraints

All status-like columns above are proposed as `text` with a `check`
constraint (e.g. `check (status in ('draft','sent','viewed','completed',
'archived'))`) rather than native Postgres `enum` types, so that adding a
new status later is a constraint migration, not a type-alteration
migration (simpler, non-blocking). This is a low-risk convention choice,
not flagged as a decision needing approval.
