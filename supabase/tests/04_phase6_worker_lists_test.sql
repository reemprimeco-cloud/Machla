-- HomeList — Phase 6 test suite: the worker's shopping-list lifecycle.
--
-- Covers the Phase 6 acceptance path (a worker builds a list and sends
-- it) and the two guarantees around it that are security-shaped rather
-- than cosmetic:
--
--   * a worker may modify only their OWN draft — not a fellow worker's in
--     the same household, and not anything in another household;
--   * NOTHING a worker can call writes purchase_status, purchased_at, or
--     purchased_by_user_id. Those belong to the household side of the
--     checklist (approved Phase 0 decision 6, Section 16A.2/16A.5).
--
-- Plus the grouping guarantee from Amendment 1 §16A.4: category_id is a
-- snapshot taken at add-time, so a later re-categorization cannot move an
-- item between groups on a list that has already been sent.
--
-- Runs after the Phase 4 suite, so it creates its own households rather
-- than reusing that file's fixtures.

\pset pager off

\echo ''
\echo '=== Phase 6 — worker shopping lists ==='

-- ============================================================
-- Fixtures
-- ============================================================

select test_create_user('66660000-0000-0000-0000-000000000001', '+96500000601'); -- owner P
select test_create_user('66660000-0000-0000-0000-000000000002', '+96500000602'); -- worker P1
select test_create_user('66660000-0000-0000-0000-000000000003', '+96500000603'); -- worker P2
select test_create_user('66660000-0000-0000-0000-000000000004', '+96500000604'); -- member P
select test_create_user('77770000-0000-0000-0000-000000000001', '+96500000701'); -- owner Q
select test_create_user('77770000-0000-0000-0000-000000000002', '+96500000702'); -- worker Q1

select test_login('66660000-0000-0000-0000-000000000001');
select create_household('Phase 6 Home P') as hh_p \gset

select test_login('77770000-0000-0000-0000-000000000001');
select create_household('Phase 6 Home Q') as hh_q \gset

-- Membership, minted through the real invitation path so the fixtures
-- match what production rows actually look like.
select test_login('66660000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh_p'::uuid, 'worker') as inv_p1 \gset
select test_login('66660000-0000-0000-0000-000000000002');
select accept_invitation(:'code');

select test_login('66660000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh_p'::uuid, 'worker') as inv_p2 \gset
select test_login('66660000-0000-0000-0000-000000000003');
select accept_invitation(:'code');

select test_login('66660000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh_p'::uuid, 'member') as inv_pm \gset
select test_login('66660000-0000-0000-0000-000000000004');
select accept_invitation(:'code');

select test_login('77770000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh_q'::uuid, 'worker') as inv_q1 \gset
select test_login('77770000-0000-0000-0000-000000000002');
select accept_invitation(:'code');

-- Catalogue fixtures. Two categories so grouping has something to group.
insert into public.categories (key, icon, sort_order, is_active,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values
  ('p6_dairy', '🥛', 910, true, 'P6 Dairy', 'ألبان', 'डेयरी', 'పాలు', 'ڈیری', 'Gatas', 'दुग्ध', 'Susu', 'කිරි'),
  ('p6_produce', '🥬', 911, true, 'P6 Produce', 'خضار', 'सब्ज़ी', 'కూరగాయలు', 'سبزی', 'Gulay', 'तरकारी', 'Sayur', 'එළවළු');

select id as cat_dairy from public.categories where key = 'p6_dairy' \gset
select id as cat_produce from public.categories where key = 'p6_produce' \gset

insert into public.products (
  natural_key, category_id, brand, size, unit, is_active, sort_order,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values
  ('p6_milk|almarai|1 l', :'cat_dairy', 'Almarai', '1 L', 'l', true, 9101,
   'P6 Milk', 'حليب', 'दूध', 'పాలు', 'دودھ', 'Gatas', 'दूध', 'Susu', 'කිරි'),
  ('p6_butter|lurpak|200 g', :'cat_dairy', 'Lurpak', '200 g', 'pack', true, 9102,
   'P6 Butter', 'زبدة', 'मक्खन', 'వెన్న', 'مکھن', 'Mantikilya', 'मक्खन', 'Mentega', 'බටර්'),
  ('p6_tomato||1 kg', :'cat_produce', null, '1 kg', 'kg', true, 9103,
   'P6 Tomato', 'طماطم', 'टमाटर', 'టమాటా', 'ٹماٹر', 'Kamatis', 'गोलभेँडा', 'Tomat', 'තක්කාලි'),
  ('p6_retired||1 kg', :'cat_produce', null, '1 kg', 'kg', false, 9104,
   'P6 Retired', 'متقاعد', 'बंद', 'నిలిపివేసిన', 'بند', 'Retirado', 'बन्द', 'Pensiun', 'නවතන');

select id as prod_milk from public.products where natural_key = 'p6_milk|almarai|1 l' \gset
select id as prod_butter from public.products where natural_key = 'p6_butter|lurpak|200 g' \gset
select id as prod_tomato from public.products where natural_key = 'p6_tomato||1 kg' \gset
select id as prod_retired from public.products where natural_key = 'p6_retired||1 kg' \gset

-- Everything from here runs as `authenticated`, not as the superuser.
-- This matters: a superuser bypasses RLS, so every "cannot read another
-- household's list" assertion would pass vacuously — it would be
-- measuring nothing at all. The SECURITY DEFINER RPCs behave identically
-- either way (they check auth.uid() themselves), but the reads do not.
set role authenticated;

-- ============================================================
-- 1. Draft lifecycle
-- ============================================================

select test_login(null);
select test_raises(
  format($$ select get_or_create_draft_list(%L::uuid, 'en') $$, :'hh_p'),
  'AUTH_REQUIRED',
  'an unauthenticated caller cannot open a draft'
);

select test_login('66660000-0000-0000-0000-000000000002'); -- worker P1
select get_or_create_draft_list(:'hh_p'::uuid, 'hi') as list_p1 \gset

select test_assert(
  (select status = 'draft' and language = 'hi'
     and created_by_user_id = '66660000-0000-0000-0000-000000000002'
   from shopping_lists where id = :'list_p1'),
  'a worker opens a draft in their own household, in their own language'
);

-- The property that makes the list survive the app being closed: calling
-- again resumes the same draft rather than starting a second one.
select test_assert(
  (select get_or_create_draft_list(:'hh_p'::uuid, 'hi') = :'list_p1'::uuid),
  'reopening returns the same draft rather than creating a second'
);

select test_assert(
  (select count(*) = 1 from shopping_lists
   where household_id = :'hh_p' and created_by_user_id = '66660000-0000-0000-0000-000000000002'),
  'only one draft row exists after reopening'
);

-- A worker from the other household must not be able to open a draft here.
select test_login('77770000-0000-0000-0000-000000000002'); -- worker Q1
select test_raises(
  format($$ select get_or_create_draft_list(%L::uuid, 'en') $$, :'hh_p'),
  'FORBIDDEN',
  'a worker cannot open a draft in a household they do not belong to'
);

-- Members build lists too — list permissions are not owner-only, only
-- household *management* is (04-roles-permission-matrix.md).
select test_login('66660000-0000-0000-0000-000000000004'); -- member P
select get_or_create_draft_list(:'hh_p'::uuid, 'ar') as list_pm \gset

select test_assert(
  (select :'list_pm'::uuid <> :'list_p1'::uuid),
  'a member gets their own draft, distinct from the worker''s'
);

-- ============================================================
-- 2. Adding items
-- ============================================================

select test_login('66660000-0000-0000-0000-000000000002'); -- worker P1

select set_list_item(:'list_p1'::uuid, :'prod_milk'::uuid, 2) as item_milk \gset

select test_assert(
  (select quantity = 2 and unit = 'l' and category_id = :'cat_dairy'::uuid
     and purchase_status = 'pending' and purchased_at is null
     and purchased_by_user_id is null
   from shopping_list_items where id = :'item_milk'),
  'adding an item snapshots unit and category, and leaves purchase state untouched'
);

-- sort_order is snapshotted from the product so the group renders in
-- aisle order rather than insertion order.
select test_assert(
  (select sort_order = 9101 from shopping_list_items where id = :'item_milk'),
  'item sort_order is snapshotted from the product'
);

-- Upsert, not insert: the quantity stepper calls this repeatedly.
select test_assert(
  (select set_list_item(:'list_p1'::uuid, :'prod_milk'::uuid, 5) = :'item_milk'::uuid),
  'setting the same product again updates the existing row'
);

select test_assert(
  (select count(*) = 1 from shopping_list_items
   where list_id = :'list_p1' and product_id = :'prod_milk'),
  'a repeated add does not duplicate the item'
);

select test_assert(
  (select quantity = 5 from shopping_list_items where id = :'item_milk'),
  'the quantity is updated in place'
);

select set_list_item(:'list_p1'::uuid, :'prod_tomato'::uuid, 1, '  ripe ones  ');

select test_assert(
  (select note = 'ripe ones' from shopping_list_items
   where list_id = :'list_p1' and product_id = :'prod_tomato'),
  'a note is trimmed before storage'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 0) $$, :'list_p1', :'prod_butter'),
  'INVALID_QUANTITY',
  'a zero quantity is rejected'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, -3) $$, :'list_p1', :'prod_butter'),
  'INVALID_QUANTITY',
  'a negative quantity is rejected'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 1000) $$, :'list_p1', :'prod_butter'),
  'INVALID_QUANTITY',
  'an absurd quantity is rejected before it reaches the owner''s screen'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 1) $$, :'list_p1', :'prod_retired'),
  'PRODUCT_NOT_FOUND',
  'an inactive product cannot be added'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, '00000000-0000-0000-0000-0000000000ff'::uuid, 1) $$, :'list_p1'),
  'PRODUCT_NOT_FOUND',
  'an unknown product cannot be added'
);

-- ============================================================
-- 3. Frequently-used counters
-- ============================================================

-- Counts how often a product is *chosen*. The milk above was added once
-- and then re-quantified once, which must count as one selection.
select test_assert(
  (select selection_count = 1 from product_usage_stats
   where user_id = '66660000-0000-0000-0000-000000000002' and product_id = :'prod_milk'),
  'changing a quantity does not inflate the frequently-used counter'
);

select test_assert(
  (select count(*) = 2 from product_usage_stats
   where user_id = '66660000-0000-0000-0000-000000000002'),
  'one usage row per distinct product chosen'
);

select test_assert(
  (select count(*) = 0 from product_usage_stats
   where user_id = '66660000-0000-0000-0000-000000000003'),
  'one worker''s selections do not accrue to another'
);

select test_assert(
  (select count(*) = 2 from get_frequent_products(50)),
  'get_frequent_products returns the caller''s own products'
);

select test_login('66660000-0000-0000-0000-000000000003'); -- worker P2
select test_assert(
  (select count(*) = 0 from get_frequent_products(50)),
  'a different worker sees none of them'
);

-- ============================================================
-- 4. A draft belongs to exactly one person
-- ============================================================

-- Worker P2 is an active member of the SAME household, so RLS lets them
-- read the list. They still must not be able to change it.
select test_assert(
  (select count(*) = 1 from shopping_lists where id = :'list_p1'),
  'a fellow member of the household can read the list'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 9) $$, :'list_p1', :'prod_butter'),
  'LIST_NOT_FOUND',
  'a fellow worker cannot add to someone else''s draft'
);

select test_raises(
  format($$ select remove_list_item(%L::uuid, %L::uuid) $$, :'list_p1', :'prod_milk'),
  'LIST_NOT_FOUND',
  'a fellow worker cannot remove from someone else''s draft'
);

select test_raises(
  format($$ select send_list(%L::uuid) $$, :'list_p1'),
  'LIST_NOT_FOUND',
  'a fellow worker cannot send someone else''s draft'
);

-- The owner is no more privileged here than anyone else: list authorship
-- is per-user, and household management does not extend to editing
-- another person's draft.
select test_login('66660000-0000-0000-0000-000000000001'); -- owner P
select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 9) $$, :'list_p1', :'prod_butter'),
  'LIST_NOT_FOUND',
  'even the household owner cannot edit a worker''s draft'
);

-- Cross-household: not readable, not writable, and indistinguishable
-- from a list that does not exist.
select test_login('77770000-0000-0000-0000-000000000002'); -- worker Q1
select test_assert(
  (select count(*) = 0 from shopping_lists where id = :'list_p1'),
  'a worker in another household cannot read the list at all'
);

select test_assert(
  (select count(*) = 0 from shopping_list_items where list_id = :'list_p1'),
  'nor its items'
);

select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 1) $$, :'list_p1', :'prod_milk'),
  'LIST_NOT_FOUND',
  'nor modify it — and the refusal does not reveal that it exists'
);

-- ============================================================
-- 5. Removing items
-- ============================================================

select test_login('66660000-0000-0000-0000-000000000002'); -- worker P1

select test_assert(
  (select remove_list_item(:'list_p1'::uuid, :'prod_tomato'::uuid)),
  'a worker removes an item from their own draft'
);

select test_assert(
  (select count(*) = 0 from shopping_list_items
   where list_id = :'list_p1' and product_id = :'prod_tomato'),
  'the item is gone'
);

select test_assert(
  (select remove_list_item(:'list_p1'::uuid, :'prod_tomato'::uuid) is false),
  'removing an item that is not on the list reports false rather than raising'
);

-- ============================================================
-- 6. Sending
-- ============================================================

select test_login('66660000-0000-0000-0000-000000000003'); -- worker P2
select get_or_create_draft_list(:'hh_p'::uuid, 'en') as list_p2 \gset

select test_raises(
  format($$ select send_list(%L::uuid) $$, :'list_p2'),
  'LIST_EMPTY',
  'an empty list cannot be sent'
);

select test_login('66660000-0000-0000-0000-000000000002'); -- worker P1
select send_list(:'list_p1'::uuid) as sent_at \gset

select test_assert(
  (select status = 'sent' and sent_at is not null and viewed_at is null
     and completed_at is null
   from shopping_lists where id = :'list_p1'),
  'sending moves the list to sent and stamps sent_at'
);

-- A sent list is the record of what was asked for. If the worker could
-- keep editing it, the two sides would disagree about the request.
select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 1) $$, :'list_p1', :'prod_butter'),
  'LIST_NOT_DRAFT',
  'a sent list cannot be added to'
);

select test_raises(
  format($$ select remove_list_item(%L::uuid, %L::uuid) $$, :'list_p1', :'prod_milk'),
  'LIST_NOT_DRAFT',
  'a sent list cannot be removed from'
);

select test_raises(
  format($$ select send_list(%L::uuid) $$, :'list_p1'),
  'LIST_NOT_DRAFT',
  'a sent list cannot be sent twice'
);

-- Sending ends that draft; the next shop starts a fresh one.
select get_or_create_draft_list(:'hh_p'::uuid, 'en') as list_p1b \gset

select test_assert(
  (select :'list_p1b'::uuid <> :'list_p1'::uuid),
  'after sending, opening a draft starts a new list'
);

select test_assert(
  (select count(*) = 1 from shopping_lists
   where household_id = :'hh_p'
     and created_by_user_id = '66660000-0000-0000-0000-000000000002'
     and status = 'draft'),
  'and there is still exactly one open draft'
);

-- ============================================================
-- 7. Purchase state is unreachable from the worker side
-- ============================================================

-- The strong version of Phase 0 decision 6: not "the worker UI does not
-- offer it", but "no code path the worker can call writes it".
select test_assert(
  (select bool_and(purchase_status = 'pending' and purchased_at is null
                   and purchased_by_user_id is null)
   from shopping_list_items where list_id = :'list_p1'),
  'purchase state is untouched by every RPC exercised above'
);

-- No RPC accepts it as a parameter, and no policy permits a direct write.
select test_assert(
  (select count(*) = 0
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname not like 'test\_%'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and pg_get_function_arguments(p.oid) ~* 'purchase|purchased'),
  'no function reachable by a signed-in user takes a purchase-state argument'
);

select test_login('66660000-0000-0000-0000-000000000002');

-- UPDATE under RLS with no matching policy is a silent no-op, so assert
-- the data is unchanged rather than expecting an error.
update shopping_list_items
set purchase_status = 'purchased',
    purchased_at = now(),
    purchased_by_user_id = '66660000-0000-0000-0000-000000000002'
where list_id = :'list_p1';

update shopping_lists set status = 'completed' where id = :'list_p1';

select test_raises(
  format($$ insert into shopping_lists (household_id, created_by_user_id, status, language)
            values (%L::uuid, %L::uuid, 'sent', 'en') $$,
         :'hh_p', '66660000-0000-0000-0000-000000000002'),
  'row-level security',
  'a client cannot mint a list row directly, bypassing the draft lifecycle'
);

select test_assert(
  (select bool_and(purchase_status = 'pending' and purchased_by_user_id is null)
   from shopping_list_items where list_id = :'list_p1'),
  'a worker cannot mark items purchased by direct update'
);

select test_assert(
  (select status = 'sent' from shopping_lists where id = :'list_p1'),
  'a worker cannot complete a list by direct update'
);

-- ============================================================
-- 8. Grouping survives re-categorization (Section 16A.4)
-- ============================================================

-- The catalogue is service-role-only, so drop back to the owning role to
-- simulate what a later import would do: move a product to a different
-- category.
reset role;
update public.products set category_id = :'cat_produce' where id = :'prod_milk';
set role authenticated;
select test_login('66660000-0000-0000-0000-000000000002');

select test_assert(
  (select category_id = :'cat_dairy'::uuid from shopping_list_items
   where list_id = :'list_p1' and product_id = :'prod_milk'),
  'an already-sent item keeps the category it was filed under when added'
);

select test_assert(
  (select category_id = :'cat_produce'::uuid from products where id = :'prod_milk'),
  'even though the product itself has moved category'
);

reset role;
update public.products set category_id = :'cat_dairy' where id = :'prod_milk';

-- ============================================================
-- 9. Function privileges
-- ============================================================

select test_assert(
  (select bool_and(has_function_privilege('anon', f, 'EXECUTE') is false)
   from unnest(array[
     'public.get_or_create_draft_list(uuid, text)'::regprocedure,
     'public.set_list_item(uuid, uuid, numeric, text)'::regprocedure,
     'public.remove_list_item(uuid, uuid)'::regprocedure,
     'public.send_list(uuid)'::regprocedure,
     'public.get_frequent_products(int)'::regprocedure,
     'public.assert_own_draft(uuid)'::regprocedure
   ]) as f),
  'anon can execute none of the Phase 6 functions'
);

select test_assert(
  (select bool_and(has_function_privilege('authenticated', f, 'EXECUTE'))
   from unnest(array[
     'public.get_or_create_draft_list(uuid, text)'::regprocedure,
     'public.set_list_item(uuid, uuid, numeric, text)'::regprocedure,
     'public.remove_list_item(uuid, uuid)'::regprocedure,
     'public.send_list(uuid)'::regprocedure,
     'public.get_frequent_products(int)'::regprocedure
   ]) as f),
  'a signed-in user can execute the five client-facing functions'
);

-- assert_own_draft returns a whole shopping_lists row. It is an internal
-- helper for the functions above, which are themselves authorized, so
-- exposing it would only widen the surface for no gain.
select test_assert(
  has_function_privilege('authenticated', 'public.assert_own_draft(uuid)'::regprocedure, 'EXECUTE') is false,
  'assert_own_draft is not callable by a signed-in user'
);

\echo '=== Phase 6 worker-list assertions passed ==='
