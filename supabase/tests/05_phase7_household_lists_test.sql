-- HomeList — Phase 7 test suite: the household works a received list.
--
-- The Phase 7 acceptance criterion is "the owner can identify exactly
-- which worker sent each list", and the security-shaped half of the
-- phase is the mirror of Phase 6's:
--
--   * Owner and Member may set purchase state; a Worker may not — not
--     even on a list they wrote themselves;
--   * setting purchase state cannot alter what was requested;
--   * a draft is nobody's business but its author's, in either direction.
--
-- Runs as `authenticated` throughout, because the superuser bypasses RLS
-- and every isolation assertion would pass vacuously.

\pset pager off

\echo ''
\echo '=== Phase 7 — household list handling ==='

-- ============================================================
-- Fixtures
-- ============================================================

select test_create_user('77000000-0000-0000-0000-000000000001', '+96500000801'); -- owner
select test_create_user('77000000-0000-0000-0000-000000000002', '+96500000802'); -- member
select test_create_user('77000000-0000-0000-0000-000000000003', '+96500000803'); -- worker
select test_create_user('88000000-0000-0000-0000-000000000001', '+96500000811'); -- outsider owner

select test_login('77000000-0000-0000-0000-000000000001');
select create_household('Phase 7 Home') as hh7 \gset

select test_login('88000000-0000-0000-0000-000000000001');
select create_household('Phase 7 Other Home') as hh7_other \gset

select test_login('77000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh7'::uuid, 'member') as i1 \gset
select test_login('77000000-0000-0000-0000-000000000002');
select accept_invitation(:'code');

select test_login('77000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh7'::uuid, 'worker') as i2 \gset
select test_login('77000000-0000-0000-0000-000000000003');
select accept_invitation(:'code');

-- Give the worker a display name, since the acceptance criterion is about
-- identifying them by it.
update public.users set display_name = 'Maria'
where id = '77000000-0000-0000-0000-000000000003';

insert into public.categories (key, icon, sort_order, is_active,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values ('p7_cat', '🧺', 920, true,
  'P7', 'ف٧', 'प७', 'ప७', 'پ۷', 'P7', 'प७', 'P7', 'ප7');

select id as p7cat from public.categories where key = 'p7_cat' \gset

insert into public.products (
  natural_key, category_id, unit, is_active, sort_order,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values
  ('p7_a||1', :'p7cat', 'pcs', true, 9201, 'A','A','A','A','A','A','A','A','A'),
  ('p7_b||1', :'p7cat', 'pcs', true, 9202, 'B','B','B','B','B','B','B','B','B'),
  ('p7_c||1', :'p7cat', 'pcs', true, 9203, 'C','C','C','C','C','C','C','C','C');

select id as p7a from public.products where natural_key = 'p7_a||1' \gset
select id as p7b from public.products where natural_key = 'p7_b||1' \gset
select id as p7c from public.products where natural_key = 'p7_c||1' \gset

set role authenticated;

-- Worker builds and sends a list of three items.
select test_login('77000000-0000-0000-0000-000000000003');
select get_or_create_draft_list(:'hh7'::uuid, 'fil') as list7 \gset
select set_list_item(:'list7'::uuid, :'p7a'::uuid, 2);
select set_list_item(:'list7'::uuid, :'p7b'::uuid, 1);
select set_list_item(:'list7'::uuid, :'p7c'::uuid, 3);

select id as item_a from shopping_list_items
  where list_id = :'list7' and product_id = :'p7a' \gset
select id as item_b from shopping_list_items
  where list_id = :'list7' and product_id = :'p7b' \gset

-- ============================================================
-- 1. A draft is nobody else's business
-- ============================================================

select test_login('77000000-0000-0000-0000-000000000001'); -- owner

select test_raises(
  format($$ select mark_list_viewed(%L::uuid) $$, :'list7'),
  'LIST_NOT_SENT',
  'the owner cannot open a list that has not been sent'
);

select test_raises(
  format($$ select set_purchase_status(%L::uuid, 'purchased') $$, :'item_a'),
  'LIST_NOT_SENT',
  'the owner cannot check off items on an unsent draft'
);

select test_assert(
  (select count(*) = 0 from get_household_lists(:'hh7'::uuid)),
  'a draft does not appear in the household''s lists'
);

select test_login('77000000-0000-0000-0000-000000000003');
select send_list(:'list7'::uuid);

-- ============================================================
-- 2. Receiving, and identifying the sender
-- ============================================================

select test_login('77000000-0000-0000-0000-000000000001'); -- owner

select test_assert(
  (select count(*) = 1 from get_household_lists(:'hh7'::uuid)),
  'a sent list appears in the household''s lists'
);

-- The Phase 7 acceptance criterion, asserted directly. `users` is scoped
-- by RLS to the caller's own row, so without the RPC the owner could not
-- resolve this name at all.
select test_assert(
  (select created_by_name = 'Maria' and created_by_user_id = '77000000-0000-0000-0000-000000000003'
   from get_household_lists(:'hh7'::uuid)),
  'the owner can identify exactly which worker sent the list'
);

select test_assert(
  (select count(*) = 0 from users where id = '77000000-0000-0000-0000-000000000003'),
  'and still cannot read that worker''s user row directly'
);

select test_assert(
  (select total_items = 3 and purchased_items = 0 and unavailable_items = 0
   from get_household_lists(:'hh7'::uuid)),
  'progress starts at zero of three'
);

select test_assert(
  (select status = 'sent' and sent_at is not null and viewed_at is null
   from get_household_lists(:'hh7'::uuid)),
  'the list arrives as sent, not yet viewed'
);

select mark_list_viewed(:'list7'::uuid);

select test_assert(
  (select status = 'viewed' and viewed_at is not null
   from get_household_lists(:'hh7'::uuid)),
  'opening the list marks it viewed'
);

-- ============================================================
-- 3. Working the checklist
-- ============================================================

select set_purchase_status(:'item_a'::uuid, 'purchased');

select test_assert(
  (select purchase_status = 'purchased' and purchased_at is not null
     and purchased_by_user_id = '77000000-0000-0000-0000-000000000001'
   from shopping_list_items where id = :'item_a'),
  'the owner checks an item off, and is recorded as having done so'
);

-- §16A.3: checking an item off must not be able to change the request.
select test_assert(
  (select quantity = 2 and product_id = :'p7a'::uuid and category_id = :'p7cat'::uuid
   from shopping_list_items where id = :'item_a'),
  'the requested quantity, product and category are untouched by checking off'
);

select set_purchase_status(:'item_b'::uuid, 'unavailable');

select test_assert(
  (select purchase_status = 'unavailable'
   from shopping_list_items where id = :'item_b'),
  'an item can be marked unavailable'
);

select test_assert(
  (select total_items = 3 and purchased_items = 1 and unavailable_items = 1
   from get_household_lists(:'hh7'::uuid)),
  'progress counts purchased and unavailable separately'
);

-- Un-checking clears the attribution rather than leaving a stale one.
select set_purchase_status(:'item_a'::uuid, 'pending');

select test_assert(
  (select purchase_status = 'pending' and purchased_at is null
     and purchased_by_user_id is null
   from shopping_list_items where id = :'item_a'),
  'un-checking clears both the timestamp and the attribution'
);

select set_purchase_status(:'item_a'::uuid, 'purchased');

select test_raises(
  format($$ select set_purchase_status(%L::uuid, 'eaten') $$, :'item_a'),
  'INVALID_STATUS',
  'an unknown purchase status is rejected'
);

-- ============================================================
-- 4. A Member has the same checklist rights as the Owner
-- ============================================================

select test_login('77000000-0000-0000-0000-000000000002'); -- member

select set_purchase_status(:'item_b'::uuid, 'purchased');

select test_assert(
  (select purchased_by_user_id = '77000000-0000-0000-0000-000000000002'
   from shopping_list_items where id = :'item_b'),
  'a member can work the checklist, and is attributed correctly'
);

select test_assert(
  (select mark_list_viewed(:'list7'::uuid) is not null),
  'a member can open a list'
);

-- ============================================================
-- 5. The Worker cannot cross the line
-- ============================================================

select test_login('77000000-0000-0000-0000-000000000003'); -- worker, and the author

select test_raises(
  format($$ select set_purchase_status(%L::uuid, 'purchased') $$, :'item_a'),
  'NOT_HOUSEHOLD_SIDE',
  'a worker cannot mark an item purchased — not even on the list they wrote'
);

select test_raises(
  format($$ select set_list_completed(%L::uuid, true) $$, :'list7'),
  'NOT_HOUSEHOLD_SIDE',
  'a worker cannot complete a list'
);

select test_raises(
  format($$ select mark_list_viewed(%L::uuid) $$, :'list7'),
  'NOT_HOUSEHOLD_SIDE',
  'a worker cannot mark a list viewed on the household''s behalf'
);

-- And the Phase 6 side stays shut now that the list is sent.
select test_raises(
  format($$ select set_list_item(%L::uuid, %L::uuid, 9) $$, :'list7', :'p7c'),
  'LIST_NOT_DRAFT',
  'the author cannot revise the request after sending it'
);

-- A worker may still *read* the household's progress.
select test_assert(
  (select purchased_items = 2 from get_household_lists(:'hh7'::uuid)),
  'a worker can see how far the shopping has got'
);

-- ============================================================
-- 6. Cross-household isolation
-- ============================================================

select test_login('88000000-0000-0000-0000-000000000001'); -- outsider owner

select test_raises(
  format($$ select get_household_lists(%L::uuid) $$, :'hh7'),
  'FORBIDDEN',
  'an outsider cannot list another household''s lists'
);

select test_raises(
  format($$ select set_purchase_status(%L::uuid, 'purchased') $$, :'item_a'),
  'LIST_NOT_FOUND',
  'an outsider cannot check off another household''s items'
);

select test_raises(
  format($$ select mark_list_viewed(%L::uuid) $$, :'list7'),
  'LIST_NOT_FOUND',
  'and the refusal does not reveal that the list exists'
);

select test_assert(
  (select count(*) = 0 from shopping_list_items where id = :'item_a'),
  'nor can they read the item at all'
);

-- ============================================================
-- 7. Completing — and archiving (20260812160000_archive_completed_lists.sql)
-- ============================================================

select test_login('77000000-0000-0000-0000-000000000001'); -- owner

-- Deliberately allowed with an item still pending: a shop can finish with
-- something unavailable, and refusing to close the list would only teach
-- people to fake the checkboxes. Completing ends at 'archived', not
-- 'completed' — the owner-requested behavior is that a finished list
-- disappears immediately and for good, not that it lands in a reopenable
-- state.
select test_assert(
  (select status = 'archived' and completed_at is not null
   from set_list_completed(:'list7'::uuid, true)),
  'the owner completes the list even with an item outstanding, and it archives'
);

-- No route back: assert_can_work_list refuses to return an archived list
-- to any RPC, including the "reopen" call itself.
select test_raises(
  format($$ select set_list_completed(%L::uuid, false) $$, :'list7'),
  'LIST_ARCHIVED',
  'an archived list cannot be reopened'
);

-- It also stops appearing anywhere — the household's own list view...
select test_assert(
  (select count(*) = 0 from get_household_lists(:'hh7'::uuid)),
  'a completed list disappears from the household''s list view entirely'
);

-- ...and even a direct lookup by id, so a stale bookmark or a
-- notification's "Open list" link finds nothing either.
select test_assert(
  (select count(*) = 0 from get_household_lists(:'hh7'::uuid, :'list7'::uuid)),
  'an archived list cannot be fetched at all, even by id'
);

-- Nothing can touch it any more, not even the purchase checklist that
-- used to stay open after completion for correcting a miscount — once
-- archived, that window is gone too.
select test_raises(
  format($$ select set_purchase_status(%L::uuid, 'pending') $$, :'item_a'),
  'LIST_ARCHIVED',
  'an archived list cannot be corrected — its items are frozen for good'
);

-- ============================================================
-- 8. Function privileges
-- ============================================================

reset role;

select test_assert(
  (select bool_and(has_function_privilege('anon', f, 'EXECUTE') is false)
   from unnest(array[
     'public.mark_list_viewed(uuid)'::regprocedure,
     'public.set_purchase_status(uuid, text)'::regprocedure,
     'public.set_list_completed(uuid, boolean)'::regprocedure,
     'public.get_household_lists(uuid, uuid, int)'::regprocedure,
     'public.assert_can_work_list(uuid)'::regprocedure
   ]) as f),
  'anon can execute none of the Phase 7 functions'
);

select test_assert(
  has_function_privilege('authenticated', 'public.assert_can_work_list(uuid)'::regprocedure, 'EXECUTE') is false,
  'assert_can_work_list is not callable by a signed-in user'
);

-- The structural guarantee, restated at the schema level: exactly one
-- function reachable by a signed-in user *assigns* purchase_status. The
-- regex anchors on the UPDATE ... SET form, so a function that merely
-- reads the column — get_household_lists counts by it — does not count.
--
-- prokind 'f' = plain function: pg_get_functiondef() errors outright on
-- an aggregate, and a plain Postgres keeps pgcrypto's in `public`.
select test_assert(
  (select count(*) = 1
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.proname not like 'test\_%'
     and p.prokind = 'f'
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and pg_get_functiondef(p.oid) ~* 'set\s+purchase_status\s*='),
  'exactly one signed-in-callable function assigns purchase_status'
);

-- The Phase 6 counterpart: the worker's write path does not so much as
-- name the purchase columns. Asserted on the shipped definition rather
-- than on behaviour, because behaviour would pass even if the column
-- were written with a value that happened to match.
-- `--` comments are stripped first: set_list_item's body carries a note
-- explaining which columns it deliberately omits, and matching on that
-- would fail the assertion for saying the right thing.
select test_assert(
  (select regexp_replace(
            pg_get_functiondef('public.set_list_item(uuid, uuid, numeric, text, boolean)'::regprocedure),
            '--[^\n]*', '', 'g')
          !~* 'purchase_status|purchased_at|purchased_by_user_id'),
  'set_list_item does not touch the purchase columns in any executable line'
);

\echo '=== Phase 7 household-list assertions passed ==='
