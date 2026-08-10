-- ============================================================
-- Photographed items (20260810140000_photo_items.sql)
-- ============================================================
--
-- What is verified here and what is NOT:
--
-- The RPCs, the XOR constraint, the path binding and the own-draft gate
-- are all plain Postgres and are covered below, run as `authenticated`.
--
-- The storage.objects POLICIES are not, and cannot be: this harness is a
-- plain PostgreSQL instance with no `storage` schema (the migration
-- skips the bucket block accordingly). Those policies are the other half
-- of the isolation story and are verified against the live project
-- instead — see docs/architecture/19-photo-items.md §4. Saying so here
-- is the point: a reader must not mistake a green suite for proof that
-- the bucket is locked down.

\set ON_ERROR_STOP on
\pset pager off

\echo ''
\echo '=== Photographed items ==='

-- ============================================================
-- Fixtures: two households, so isolation has something to isolate
-- ============================================================

select test_create_user('99990000-0000-0000-0000-000000000001', '+96599000001'); -- owner A
select test_create_user('99990000-0000-0000-0000-000000000002', '+96599000002'); -- worker A
select test_create_user('99990000-0000-0000-0000-000000000003', '+96599000003'); -- owner B
select test_create_user('99990000-0000-0000-0000-000000000004', '+96599000004'); -- worker B

select test_login('99990000-0000-0000-0000-000000000001');
select create_household('Photo Home A') as hh_a \gset
select code from create_invitation(:'hh_a'::uuid, 'worker') as inv_a \gset
select test_login('99990000-0000-0000-0000-000000000002');
select accept_invitation(:'code');

select test_login('99990000-0000-0000-0000-000000000003');
select create_household('Photo Home B') as hh_b \gset
select code from create_invitation(:'hh_b'::uuid, 'worker') as inv_b \gset
select test_login('99990000-0000-0000-0000-000000000004');
select accept_invitation(:'code');

-- Worker A's draft.
select test_login('99990000-0000-0000-0000-000000000002');
select get_or_create_draft_list(:'hh_a'::uuid, 'en') as list_a \gset

set role authenticated;

-- ============================================================
-- 1. The happy path
-- ============================================================

select test_login('99990000-0000-0000-0000-000000000002');

select add_photo_item(
  :'list_a'::uuid,
  :'hh_a' || '/' || :'list_a' || '/shot-1.jpg',
  2,
  'the blue one'
) as photo_item_1 \gset

select test_assert(
  (select count(*) = 1 from shopping_list_items
    where id = :'photo_item_1' and product_id is null and photo_path is not null),
  'a photographed item is stored with no product_id'
);

select test_assert(
  (select quantity = 2 and note = 'the blue one' and unit = 'piece'
   from shopping_list_items where id = :'photo_item_1'),
  'quantity and note travel with the photograph'
);

select test_assert(
  (select c.key = 'photo' and c.is_capture
   from shopping_list_items sli join categories c on c.id = sli.category_id
   where sli.id = :'photo_item_1'),
  'and it lands in the capture category, so §16A grouping needs no special case'
);

-- ============================================================
-- 2. The XOR constraint holds against direct writes
-- ============================================================
-- The RPC cannot produce these, but the constraint is what makes that
-- true of every future writer as well.

reset role;

select test_raises(
  format($$ insert into shopping_list_items (list_id, category_id, quantity, unit, sort_order)
            values (%L::uuid, (select id from categories where key = 'photo'), 1, 'piece', 0) $$,
         :'list_a'),
  'shopping_list_items_product_xor_photo',
  'an item with neither a product nor a photograph is rejected'
);

select test_raises(
  format($$ insert into shopping_list_items
              (list_id, product_id, category_id, photo_path, quantity, unit, sort_order)
            values (%L::uuid, (select id from products limit 1),
                    (select id from categories where key = 'photo'),
                    'x/y/z.jpg', 1, 'piece', 0) $$,
         :'list_a'),
  'shopping_list_items_product_xor_photo',
  'and so is an item claiming to be both'
);

set role authenticated;

-- ============================================================
-- 3. The path must belong to this household AND this list
-- ============================================================
-- This is the assertion that matters most. The storage policy can only
-- see the household segment; nothing but this check stops a member of
-- two households attaching one household's photograph to the other's
-- list, or attaching another list's photograph to this one.

select test_login('99990000-0000-0000-0000-000000000002');

select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_b' || '/' || :'list_a' || '/stolen.jpg'),
  'INVALID_PHOTO_PATH',
  'a path under a different household is refused'
);

select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_a' || '/00000000-0000-0000-0000-0000000000ff/other.jpg'),
  'INVALID_PHOTO_PATH',
  'a path under a different list is refused'
);

select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_a' || '/' || :'list_a' || '/../../escape.jpg'),
  'INVALID_PHOTO_PATH',
  'and a traversal attempt is refused'
);

select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_a' || '/' || :'list_a' || '/'),
  'INVALID_PHOTO_PATH',
  'an empty filename is refused'
);

-- Control: after four refusals, the legitimate path still works. Without
-- this, a function that rejected everything would look identical.
select add_photo_item(:'list_a'::uuid, :'hh_a' || '/' || :'list_a' || '/shot-2.jpg', 1, null)
  as photo_item_2 \gset

select test_assert(
  (select count(*) = 2 from shopping_list_items
    where list_id = :'list_a'::uuid and photo_path is not null),
  'control: a well-formed path is still accepted after the refusals'
);

-- ============================================================
-- 4. Only the draft's own worker may add or remove
-- ============================================================

select test_login('99990000-0000-0000-0000-000000000004');   -- worker in household B

select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_a' || '/' || :'list_a' || '/intruder.jpg'),
  'LIST_NOT_FOUND',
  'an outside worker cannot add a photograph to a list they cannot see'
);

select test_raises(
  format($$ select remove_photo_item(%L::uuid) $$, :'photo_item_1'),
  'LIST_NOT_FOUND',
  'nor remove one'
);

select test_login('99990000-0000-0000-0000-000000000001');   -- the OWNER of household A

-- LIST_NOT_FOUND, not FORBIDDEN: assert_own_draft gives the same refusal
-- whether a list is missing or simply someone else's, so that ids cannot
-- be probed. The owner of the household is still not the author of this
-- draft, and that is all the caller is told.
select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_a' || '/' || :'list_a' || '/owner.jpg'),
  'LIST_NOT_FOUND',
  'even the household owner cannot add to a worker''s draft'
);

-- ============================================================
-- 5. Removal, and the freeze after sending
-- ============================================================

select test_login('99990000-0000-0000-0000-000000000002');

select test_assert(
  (select remove_photo_item(:'photo_item_2'::uuid)),
  'the worker can remove their own photographed item while it is a draft'
);

select test_assert(
  (select count(*) = 1 from shopping_list_items where list_id = :'list_a'::uuid),
  'and it is gone'
);

select send_list(:'list_a'::uuid);

select test_raises(
  format($$ select add_photo_item(%L::uuid, %L, 1, null) $$,
         :'list_a', :'hh_a' || '/' || :'list_a' || '/late.jpg'),
  'LIST_NOT_DRAFT',
  'no photograph may be added after the list is sent'
);

select test_raises(
  format($$ select remove_photo_item(%L::uuid) $$, :'photo_item_1'),
  'LIST_NOT_DRAFT',
  'and none may be removed — a sent list is frozen'
);

-- ============================================================
-- 6. The household receives it
-- ============================================================

select test_login('99990000-0000-0000-0000-000000000001');

select test_assert(
  (select total_items = 1 from get_household_lists(:'hh_a'::uuid, :'list_a'::uuid)),
  'the photographed item counts toward the household''s progress like any other'
);

select test_assert(
  (select photo_path is not null from shopping_list_items where id = :'photo_item_1'),
  'and the owner can read the photograph path'
);

select set_purchase_status(:'photo_item_1'::uuid, 'purchased');

select test_assert(
  (select purchased_items = 1 from get_household_lists(:'hh_a'::uuid, :'list_a'::uuid)),
  'and can tick it off, because the checklist never cared what an item is'
);

-- ============================================================
-- 7. Cross-household isolation of the row itself
-- ============================================================

select test_login('99990000-0000-0000-0000-000000000003');   -- owner of household B

select test_assert(
  (select count(*) = 0 from shopping_list_items where id = :'photo_item_1'),
  'another household sees no trace of the photographed item'
);

select test_login('99990000-0000-0000-0000-000000000004');   -- worker of household B

select test_assert(
  (select count(*) = 0 from shopping_list_items where photo_path is not null),
  'and neither does its worker'
);

reset role;

\echo '=== Photo item assertions passed ==='
