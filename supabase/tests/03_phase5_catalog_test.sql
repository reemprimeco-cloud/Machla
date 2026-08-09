-- HomeList — Phase 5: product catalogue assertions.
--
-- Covers the four properties Phase 5 is responsible for:
--   1. the catalogue carries no price, in any column, ever;
--   2. it is world-readable but client-unwritable — the offline importer
--      running as service_role is the only write path;
--   3. natural_key makes the import idempotent, and the index backing it
--      is usable as an ON CONFLICT arbiter;
--   4. search finds a product from any of the nine languages plus brand
--      and transliteration, not only the caller's UI language.
--
-- Fixtures are created here rather than assumed: run-tests.sh applies the
-- migrations to an empty database, so no catalogue rows exist.

\pset pager off

\echo ''
\echo '=== Phase 5 — product catalogue ==='

-- ============================================================
-- No prices — the standing product constraint
-- ============================================================

-- Asserted against the live schema rather than the source files, because
-- this is the guarantee that has to survive someone adding a column by
-- hand in the dashboard. catalog-import/scripts/build-catalog.mjs
-- enforces the same rule on the way in.
select test_assert(
  (select count(*) = 0
   from information_schema.columns
   where table_schema = 'public'
     and table_name in ('categories', 'products')
     and (column_name ~* '(price|cost|currency|amount)' or column_name ~* '\mkwd\M')),
  'no price-like column exists on categories or products'
);

-- An extension in `public` ships its functions into the schema PostgREST
-- exposes, and extension functions carry EXECUTE for PUBLIC — so
-- similarity() and friends would be callable over /rest/v1/rpc/ by anon.
select test_assert(
  (select n.nspname <> 'public'
   from pg_extension e join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm'),
  'pg_trgm is not installed in the public (API-exposed) schema'
);

-- ============================================================
-- Fixtures
-- ============================================================

insert into public.categories (key, icon, sort_order, is_active,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values ('test_dairy', '🥛', 900, true,
  'Test Dairy', 'اختبار', 'परीक्षण', 'పరీక్ష', 'ٹیسٹ', 'Pagsubok', 'परीक्षण', 'Tes', 'පරීක්ෂණය');

select id as cat_id from public.categories where key = 'test_dairy' \gset

insert into public.products (
  natural_key, category_id, brand, size, unit, search_keywords, is_active, sort_order,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values
  ('t_milk|almarai|1 l', :'cat_id', 'Almarai', '1 L', 'l',
   array['milk', 'gatas', 'doodh', 'haleeb', 'almarai'], true, 9001,
   'Fresh Milk', 'حليب طازج', 'ताज़ा दूध', 'తాజా పాలు', 'تازہ دودھ',
   'Sariwang Gatas', 'ताजा दूध', 'Susu Segar', 'නැවුම් කිරි'),
  ('t_butter|lurpak|200 g', :'cat_id', 'Lurpak', '200 g', 'pack',
   array['butter', 'zubda', 'makhan'], true, 9002,
   'Butter', 'زبدة', 'मक्खन', 'వెన్న', 'مکھن',
   'Mantikilya', 'मक्खन', 'Mentega', 'බටර්'),
  ('t_retired|oldbrand|1 kg', :'cat_id', 'OldBrand', '1 kg', 'kg',
   array['retired', 'gatas'], false, 9003,
   'Retired Item', 'منتج متقاعد', 'बंद उत्पाद', 'నిలిపివేసిన వస్తువు', 'بند شدہ',
   'Hindi na Available', 'बन्द उत्पादन', 'Produk Lama', 'නවතන ලද');

-- ============================================================
-- search_text is maintained by trigger
-- ============================================================

select test_assert(
  (select search_text is not null and length(search_text) > 0
   from public.products where natural_key = 't_milk|almarai|1 l'),
  'search_text is populated on insert'
);

-- Every localized name must be in the haystack, or a worker searching in
-- their own language silently gets nothing.
select test_assert(
  (select bool_and(position(lower(n) in p.search_text) > 0)
   from public.products p,
        lateral (values (p.name_en), (p.name_ar), (p.name_hi), (p.name_te), (p.name_ur),
                        (p.name_fil), (p.name_ne), (p.name_id), (p.name_si)) as v(n)
   where p.natural_key = 't_milk|almarai|1 l'),
  'search_text contains all nine localized names'
);

select test_assert(
  (select position('almarai' in search_text) > 0 and position('1 l' in search_text) > 0
   from public.products where natural_key = 't_milk|almarai|1 l'),
  'search_text contains the brand and the size'
);

select test_assert(
  (select search_text = lower(search_text)
   from public.products where natural_key = 't_milk|almarai|1 l'),
  'search_text is lowercased'
);

-- The reason it is a trigger and not an application-side field: it can
-- never drift from the row, no matter who writes it.
update public.products set name_en = 'Renamed Milk'
where natural_key = 't_milk|almarai|1 l';

select test_assert(
  (select position('renamed milk' in search_text) > 0
   from public.products where natural_key = 't_milk|almarai|1 l'),
  'search_text refreshes on update (cannot drift from the row)'
);

update public.products set name_en = 'Fresh Milk'
where natural_key = 't_milk|almarai|1 l';

-- ============================================================
-- natural_key / idempotent import
-- ============================================================

select test_raises(
  format($$ insert into public.products (
              natural_key, category_id, unit, sort_order,
              name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
            values ('t_milk|almarai|1 l', %L::uuid, 'l', 9099,
                    'Dup', 'Dup', 'Dup', 'Dup', 'Dup', 'Dup', 'Dup', 'Dup', 'Dup') $$, :'cat_id'),
  'products_natural_key_idx',
  'a duplicate natural_key is rejected'
);

-- The index must not be partial. PostgREST's on_conflict=natural_key
-- emits `on conflict (natural_key)` with no index predicate, and Postgres
-- refuses to infer a partial index from that — so a `where natural_key is
-- not null` predicate would break the importer's upsert outright.
select test_assert(
  (select i.indpred is null and i.indisunique
   from pg_index i where i.indexrelid = 'public.products_natural_key_idx'::regclass),
  'products_natural_key_idx is a total unique index (usable as an ON CONFLICT arbiter)'
);

-- Re-running the import must update in place, not duplicate.
insert into public.products (
  natural_key, category_id, brand, size, unit, search_keywords, is_active, sort_order,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values ('t_butter|lurpak|200 g', :'cat_id', 'Lurpak', '250 g', 'pack',
        array['butter', 'zubda', 'makhan'], true, 9002,
        'Butter', 'زبدة', 'मक्खन', 'వెన్న', 'مکھن',
        'Mantikilya', 'मक्खन', 'Mentega', 'බටර්')
on conflict (natural_key) do update set size = excluded.size;

select test_assert(
  (select count(*) = 1 from public.products where natural_key = 't_butter|lurpak|200 g')
  and (select size = '250 g' from public.products where natural_key = 't_butter|lurpak|200 g'),
  're-importing the same natural_key updates in place rather than duplicating'
);

-- ============================================================
-- Grouping determinism (Section 16A)
-- ============================================================

-- The worker's list is grouped by category and walked in aisle order. A
-- tie in sort_order makes that order depend on the planner, so the same
-- list can render in two different orders on two devices.
select test_assert(
  (select count(*) = count(distinct sort_order) from public.categories where is_active),
  'active categories have unique sort_order (deterministic grouping)'
);

select test_assert(
  (select bool_and(category_id is not null) from public.products),
  'every product resolves to a category (grouping can never orphan an item)'
);

-- ============================================================
-- search_products
-- ============================================================

-- Section 20: a Filipino speaker types "gatas", a Hindi speaker types
-- "doodh", and both land on the same row — search is not scoped to the
-- caller's UI language.
select test_assert(
  (select count(*) = 1 from public.search_products('gatas', 50)
   where natural_key = 't_milk|almarai|1 l'),
  'search finds a product by a Filipino keyword'
);

select test_assert(
  (select count(*) = 1 from public.search_products('doodh', 50)
   where natural_key = 't_milk|almarai|1 l'),
  'search finds the same product by a Hindi transliteration'
);

select test_assert(
  (select count(*) = 1 from public.search_products('නැවුම්', 50)
   where natural_key = 't_milk|almarai|1 l'),
  'search finds a product by its Sinhala name'
);

select test_assert(
  (select count(*) = 1 from public.search_products('حليب', 50)
   where natural_key = 't_milk|almarai|1 l'),
  'search finds a product by its Arabic name'
);

select test_assert(
  (select count(*) = 1 from public.search_products('Almarai', 50)
   where natural_key = 't_milk|almarai|1 l'),
  'search finds a product by brand, case-insensitively'
);

-- An inactive product stays referenceable by historical lists but must
-- not come back in search.
select test_assert(
  (select count(*) = 0 from public.search_products('retired', 50)),
  'search excludes inactive products'
);

select test_assert(
  (select count(*) = 0 from public.search_products('', 50))
  and (select count(*) = 0 from public.search_products('   ', 50))
  and (select count(*) = 0 from public.search_products(null, 50)),
  'an empty, blank, or null query returns nothing rather than the whole catalogue'
);

select test_assert(
  (select count(*) = 0 from public.search_products('qqzzxwv', 50)),
  'a query matching nothing returns nothing'
);

select test_assert(
  (select count(*) = 1 from public.search_products('milk', 1)),
  'search honours p_limit'
);

-- p_limit is clamped in the function, so a hostile or accidental value
-- cannot turn one search into a full-table dump or an empty result.
select test_assert(
  (select count(*) >= 1 from public.search_products('gatas', 0))
  and (select count(*) >= 1 from public.search_products('gatas', -5)),
  'a zero or negative p_limit is clamped up to 1 rather than returning nothing'
);

-- ============================================================
-- The catalogue is world-readable and client-unwritable
-- ============================================================

set role anon;

select test_assert(
  (select count(*) > 0 from public.categories),
  'anon can read categories (catalogue is public reference data)'
);

select test_assert(
  (select count(*) > 0 from public.products),
  'anon can read products'
);

select test_raises(
  format($$ insert into public.products (
              natural_key, category_id, unit, sort_order,
              name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
            values ('anon|injected|1', %L::uuid, 'pcs', 9500,
                    'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X') $$, :'cat_id'),
  'row-level security',
  'anon cannot insert a product'
);

select test_raises(
  $$ insert into public.categories (key, sort_order,
       name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
     values ('anon_injected', 950, 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X') $$,
  'row-level security',
  'anon cannot insert a category'
);

-- UPDATE/DELETE under RLS with no matching policy is a silent no-op, not
-- an error — so assert the data is unchanged, which is the stronger
-- property (see 01_phase4_households_test.sql).
update public.products set name_en = 'Hijacked', is_active = false;
delete from public.products;
update public.categories set name_en = 'Hijacked';
delete from public.categories;

reset role;

select test_assert(
  (select count(*) = 3 from public.products where natural_key like 't\_%'),
  'anon cannot delete catalogue products'
);

select test_assert(
  (select count(*) = 0 from public.products where name_en = 'Hijacked'),
  'anon cannot rewrite product names'
);

select test_assert(
  (select count(*) = 0 from public.categories where name_en = 'Hijacked'),
  'anon cannot rewrite category names'
);

set role authenticated;

select test_assert(
  (select count(*) > 0 from public.products),
  'a signed-in user can read the catalogue'
);

select test_raises(
  format($$ insert into public.products (
              natural_key, category_id, unit, sort_order,
              name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
            values ('user|injected|1', %L::uuid, 'pcs', 9501,
                    'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X', 'X') $$, :'cat_id'),
  'row-level security',
  'a signed-in user cannot insert a product'
);

update public.products set name_en = 'Hijacked';
delete from public.products;

reset role;

select test_assert(
  (select count(*) = 3 from public.products where natural_key like 't\_%')
  and (select count(*) = 0 from public.products where name_en = 'Hijacked'),
  'a signed-in user cannot modify or delete the catalogue'
);

-- ============================================================
-- Function privileges (same posture as every other function)
-- ============================================================

select test_assert(
  has_function_privilege('anon', 'public.search_products(text, int)'::regprocedure, 'EXECUTE') is false,
  'anon cannot execute search_products'
);

select test_assert(
  has_function_privilege('authenticated', 'public.search_products(text, int)'::regprocedure, 'EXECUTE'),
  'authenticated can execute search_products'
);

select test_assert(
  has_function_privilege('anon', 'public.products_refresh_search_text()'::regprocedure, 'EXECUTE') is false
  and has_function_privilege('authenticated', 'public.products_refresh_search_text()'::regprocedure, 'EXECUTE') is false,
  'neither role can execute products_refresh_search_text (trigger-only)'
);

-- SECURITY INVOKER, deliberately: the catalogue's RLS policy is
-- `using (true)`, so a definer-rights function would unlock nothing and
-- would only add another privileged surface.
select test_assert(
  (select prosecdef is false from pg_proc
   where oid = 'public.search_products(text, int)'::regprocedure),
  'search_products runs as the caller, not as definer'
);

\echo '=== Phase 5 catalogue assertions passed ==='
