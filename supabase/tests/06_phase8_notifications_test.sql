-- HomeList — Phase 8 test suite: notifications, read state, list history,
-- and the master plan's own end-to-end acceptance scenario.
--
-- Phase 8's stated goal is "make communication reliable", and its
-- acceptance criterion is "a sent list appears reliably in the correct
-- household". Both are asserted here, along with §16A.12, which the
-- master plan states is the definition of done for the whole
-- grouping/checklist feature.

\pset pager off

\echo ''
\echo '=== Phase 8 — notifications and list history ==='

-- ============================================================
-- Fixtures
-- ============================================================

select test_create_user('99000000-0000-0000-0000-000000000001', '+96500000901'); -- owner
select test_create_user('99000000-0000-0000-0000-000000000002', '+96500000902'); -- member
select test_create_user('99000000-0000-0000-0000-000000000003', '+96500000903'); -- worker A
select test_create_user('99000000-0000-0000-0000-000000000004', '+96500000904'); -- worker B

select test_login('99000000-0000-0000-0000-000000000001');
select create_household('Phase 8 Home') as hh8 \gset

select test_login('99000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh8'::uuid, 'member') as a \gset
select test_login('99000000-0000-0000-0000-000000000002');
select accept_invitation(:'code');

select test_login('99000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh8'::uuid, 'worker') as b \gset
select test_login('99000000-0000-0000-0000-000000000003');
select accept_invitation(:'code');

select test_login('99000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh8'::uuid, 'worker') as c \gset
select test_login('99000000-0000-0000-0000-000000000004');
select accept_invitation(:'code');

update public.users set display_name = 'Ana' where id = '99000000-0000-0000-0000-000000000003';
update public.users set display_name = 'Reem' where id = '99000000-0000-0000-0000-000000000001';

-- The six products of §16A.12, in five categories, at the sort_order the
-- master plan's numbered "recommended default order" gives them.
insert into public.categories (key, icon, sort_order, is_active,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values
  ('p8_veg',   '🥬',  1, true, 'Fruits & Vegetables','خ','फ','ప','پ','G','त','B','එ'),
  ('p8_dairy', '🥛',  2, true, 'Dairy & Eggs','ل','ड','ప','ڈ','G','द','S','කි'),
  ('p8_meat',  '🍗',  3, true, 'Meat, Chicken & Fish','ل','म','మ','گ','K','मा','D','ම'),
  ('p8_rice',  '🍚',  5, true, 'Rice, Pasta & Grains','أ','च','బ','چ','B','चा','B','ස'),
  ('p8_clean', '🧼', 11, true, 'Cleaning','ت','स','శు','ص','P','स','P','පි');

select id as c_veg   from public.categories where key = 'p8_veg' \gset
select id as c_dairy from public.categories where key = 'p8_dairy' \gset
select id as c_meat  from public.categories where key = 'p8_meat' \gset
select id as c_rice  from public.categories where key = 'p8_rice' \gset
select id as c_clean from public.categories where key = 'p8_clean' \gset

insert into public.products (
  natural_key, category_id, unit, is_active, sort_order,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values
  ('p8_tomatoes||1', :'c_veg',   'kg',  true, 1, 'Tomatoes','ط','ट','ట','ٹ','K','गो','T','ත'),
  ('p8_milk||1',     :'c_dairy', 'l',   true, 2, 'Milk','ح','दू','పా','دو','G','दू','S','කි'),
  ('p8_eggs||1',     :'c_dairy', 'box', true, 3, 'Eggs','ب','अं','గు','ان','I','अ','T','බි'),
  ('p8_chicken||1',  :'c_meat',  'kg',  true, 4, 'Chicken','د','चि','చి','مر','M','कु','A','කු'),
  ('p8_rice||1',     :'c_rice',  'kg',  true, 5, 'Rice','أ','चा','బి','چا','B','चा','B','ස'),
  ('p8_soap||1',     :'c_clean', 'l',   true, 6, 'Dish Soap','ص','ब','గి','ب','P','भा','S','පි');

select id as p_tomatoes from public.products where natural_key = 'p8_tomatoes||1' \gset
select id as p_milk     from public.products where natural_key = 'p8_milk||1' \gset
select id as p_eggs     from public.products where natural_key = 'p8_eggs||1' \gset
select id as p_chicken  from public.products where natural_key = 'p8_chicken||1' \gset
select id as p_rice     from public.products where natural_key = 'p8_rice||1' \gset
select id as p_soap     from public.products where natural_key = 'p8_soap||1' \gset

set role authenticated;

-- ============================================================
-- 1. §16A.12 — the master plan's acceptance scenario
-- ============================================================

-- "Worker selects Tomatoes x2, Milk x2, Rice x1, Chicken x2, Dish Soap x1,
--  Eggs x1 and sends the list."
select test_login('99000000-0000-0000-0000-000000000003'); -- worker Ana
select get_or_create_draft_list(:'hh8'::uuid, 'fil') as list8 \gset

select set_list_item(:'list8'::uuid, :'p_tomatoes'::uuid, 2);
select set_list_item(:'list8'::uuid, :'p_milk'::uuid, 2);
select set_list_item(:'list8'::uuid, :'p_rice'::uuid, 1);
select set_list_item(:'list8'::uuid, :'p_chicken'::uuid, 2);
select set_list_item(:'list8'::uuid, :'p_soap'::uuid, 1);
select set_list_item(:'list8'::uuid, :'p_eggs'::uuid, 1);
select send_list(:'list8'::uuid);

select test_login('99000000-0000-0000-0000-000000000001'); -- owner Reem

-- Opening the list, which is what /home/lists/[id] does on render.
select mark_list_viewed(:'list8'::uuid);

-- "The owner receives it grouped as Fruits & Vegetables / Dairy & Eggs /
--  Rice, Pasta & Grains / Meat, Chicken & Fish / Cleaning, in that order."
--
-- NOTE — the master plan contradicts itself here. Its numbered
-- "recommended default order" in §16A.2 puts Meat, Chicken & Fish at 3 and
-- Rice, Pasta & Grains at 5; the illustrative example directly above it,
-- which §16A.12 then restates, shows Rice before Meat. This asserts the
-- NUMBERED list, because that is the normative one and it is what the
-- approved Phase 5 category seed implements. Flagged for confirmation.
select test_assert(
  (select array_agg(c.name_en order by c.sort_order, sli.sort_order)
          = array['Fruits & Vegetables', 'Dairy & Eggs', 'Dairy & Eggs',
                  'Meat, Chicken & Fish', 'Rice, Pasta & Grains', 'Cleaning']
   from shopping_list_items sli
   join categories c on c.id = sli.category_id
   where sli.list_id = :'list8'),
  '16A.12: the list groups into five categories in the plan''s numbered default order'
);

select test_assert(
  (select count(distinct category_id) = 5 from shopping_list_items where list_id = :'list8'),
  '16A.12: six items across five categories'
);

-- "The owner purchases Tomatoes, Milk, Rice, and Chicken."
select set_purchase_status(
  (select id from shopping_list_items where list_id = :'list8' and product_id = :'p_tomatoes'), 'purchased');
select set_purchase_status(
  (select id from shopping_list_items where list_id = :'list8' and product_id = :'p_milk'), 'purchased');
select set_purchase_status(
  (select id from shopping_list_items where list_id = :'list8' and product_id = :'p_rice'), 'purchased');
select set_purchase_status(
  (select id from shopping_list_items where list_id = :'list8' and product_id = :'p_chicken'), 'purchased');

-- "The app shows 4 / 6 purchased."
select test_assert(
  (select purchased_items = 4 and total_items = 6
   from get_household_lists(:'hh8'::uuid, :'list8'::uuid)),
  '16A.12: the app shows 4 / 6 purchased'
);

-- And the requested quantities are exactly what was asked for, untouched
-- by four purchase-status writes.
-- Ordered by natural_key: chicken, eggs, milk, rice, soap, tomatoes.
select test_assert(
  (select array_agg(sli.quantity order by p.natural_key)
          = array[2, 1, 2, 1, 1, 2]::numeric[]
   from shopping_list_items sli
   join products p on p.id = sli.product_id
   where sli.list_id = :'list8'),
  '16A.12: every requested quantity survives the shop unchanged'
);

-- ============================================================
-- 2. Notifications on send
-- ============================================================

select test_assert(
  (select count(*) = 1 from notifications
   where list_id = :'list8' and type = 'list_sent'
     and user_id = '99000000-0000-0000-0000-000000000001'),
  'sending a list notifies the owner'
);

select test_assert(
  (select actor_name = 'Ana' and actor_user_id = '99000000-0000-0000-0000-000000000003'
   from notifications
   where list_id = :'list8' and type = 'list_sent'
     and user_id = '99000000-0000-0000-0000-000000000001'),
  'the notification names who sent it, snapshotted rather than joined'
);

select test_login('99000000-0000-0000-0000-000000000002'); -- member
select test_assert(
  (select count(*) = 1 from notifications
   where list_id = :'list8' and type = 'list_sent'),
  'and notifies the member too'
);

select test_login('99000000-0000-0000-0000-000000000004'); -- worker B
select test_assert(
  (select count(*) = 0 from notifications),
  'but not another worker, who cannot open the list anyway'
);

select test_login('99000000-0000-0000-0000-000000000003'); -- worker Ana, the sender
select test_assert(
  (select count(*) = 0 from notifications where type = 'list_sent'),
  'and never the person who performed the action'
);

-- ============================================================
-- 3. Notifications back to the author
-- ============================================================

select test_assert(
  (select count(*) = 1 from notifications
   where list_id = :'list8' and type = 'list_viewed'),
  'the author is told when the household opens their list'
);

select test_assert(
  (select count(*) = 0 from notifications
   where list_id = :'list8' and type = 'list_completed'),
  'and not told it is completed before it is'
);

select test_login('99000000-0000-0000-0000-000000000001');
select set_list_completed(:'list8'::uuid, true);

select test_login('99000000-0000-0000-0000-000000000003');
select test_assert(
  (select count(*) = 1 from notifications
   where list_id = :'list8' and type = 'list_completed'
     and actor_name = 'Reem'),
  'the author is told when the shop is finished, and by whom'
);

-- ============================================================
-- 4. Read state
-- ============================================================

select test_assert(
  (select count(*) = 2 from notifications where read_at is null),
  'notifications start unread'
);

select test_assert(
  (select mark_notifications_read() = 2),
  'marking all read reports how many changed'
);

select test_assert(
  (select count(*) = 0 from notifications where read_at is null),
  'and none remain unread'
);

select test_assert(
  (select mark_notifications_read() = 0),
  'marking again is a no-op rather than an error'
);

-- ============================================================
-- 5. Notifications are private, and unforgeable
-- ============================================================

select test_login('99000000-0000-0000-0000-000000000004'); -- worker B

select test_assert(
  (select count(*) = 0 from notifications),
  'a user sees only their own notifications'
);

-- Marking-read is scoped by user_id inside the RPC, so an id belonging to
-- someone else simply matches nothing.
select test_assert(
  (select mark_notifications_read(
     array(select id from notifications)   -- empty under RLS
   ) = 0),
  'and cannot mark anyone else''s as read'
);

select test_raises(
  format($$ insert into notifications (user_id, household_id, type)
            values (%L::uuid, %L::uuid, 'list_sent') $$,
         '99000000-0000-0000-0000-000000000004', :'hh8'),
  'row-level security',
  'a client cannot forge a notification'
);

-- ============================================================
-- 6. Preferences
-- ============================================================

select test_login('99000000-0000-0000-0000-000000000003'); -- worker Ana

select test_assert(
  (select (set_notification_preference('list_viewed', false) ->> 'list_viewed')::boolean is false),
  'a user can switch off a notification type'
);

select test_raises(
  $$ select set_notification_preference('nonsense', false) $$,
  'INVALID_TYPE',
  'an unknown notification type is rejected'
);

-- A second list, to prove the preference is actually honoured.
select get_or_create_draft_list(:'hh8'::uuid, 'fil') as list8b \gset
select set_list_item(:'list8b'::uuid, :'p_eggs'::uuid, 1);
select send_list(:'list8b'::uuid);

select test_login('99000000-0000-0000-0000-000000000001');
select mark_list_viewed(:'list8b'::uuid);

select test_login('99000000-0000-0000-0000-000000000003');
select test_assert(
  (select count(*) = 0 from notifications
   where list_id = :'list8b' and type = 'list_viewed'),
  'and then does not receive it'
);

-- The preference is per TYPE, not a blanket mute: completing the same
-- list must still reach the author.
select test_login('99000000-0000-0000-0000-000000000001');
select set_list_completed(:'list8b'::uuid, true);

select test_login('99000000-0000-0000-0000-000000000003');
select test_assert(
  (select count(*) = 1 from notifications
   where list_id = :'list8b' and type = 'list_completed'),
  'while a type they did not switch off still arrives'
);

select set_notification_preference('list_viewed', true);

-- ============================================================
-- 7. List history, and a Worker sees only their own
-- ============================================================

-- Worker B sends one too, so there is something they must not see.
select test_login('99000000-0000-0000-0000-000000000004');
select get_or_create_draft_list(:'hh8'::uuid, 'ne') as list8c \gset
select set_list_item(:'list8c'::uuid, :'p_soap'::uuid, 1);
select send_list(:'list8c'::uuid);

select test_assert(
  (select count(*) = 1 from get_household_lists(:'hh8'::uuid)),
  'a worker''s history contains only the lists they sent'
);

select test_assert(
  (select count(*) = 0 from get_household_lists(:'hh8'::uuid, :'list8'::uuid)),
  'and fetching another worker''s list by id returns nothing'
);

select test_assert(
  (select count(*) = 0 from shopping_lists where id = :'list8'),
  'the RLS policy agrees — it is not readable directly either'
);

select test_login('99000000-0000-0000-0000-000000000001'); -- owner
select test_assert(
  (select count(*) = 3 from get_household_lists(:'hh8'::uuid)),
  'the owner sees every list in the household'
);

select test_login('99000000-0000-0000-0000-000000000002'); -- member
select test_assert(
  (select count(*) = 3 from get_household_lists(:'hh8'::uuid)),
  'and so does a member'
);

-- §16A.10: a completed list keeps the whole record.
select test_assert(
  (select completed_at is not null and sent_at is not null and viewed_at is not null
     and created_by_name = 'Ana'
   from get_household_lists(:'hh8'::uuid, :'list8'::uuid)),
  '16A.10: a completed list preserves who sent it and every timestamp'
);

select test_assert(
  (select count(*) = 4 from shopping_list_items
   where list_id = :'list8' and purchased_by_user_id is not null),
  '16A.10: and who purchased each item'
);

-- ============================================================
-- 8. Function privileges
-- ============================================================

reset role;

select test_assert(
  (select bool_and(has_function_privilege('anon', f, 'EXECUTE') is false)
   from unnest(array[
     'public.mark_notifications_read(uuid[])'::regprocedure,
     'public.set_notification_preference(text, boolean)'::regprocedure,
     'public.notify_list_status_change()'::regprocedure
   ]) as f),
  'anon can execute none of the Phase 8 functions'
);

select test_assert(
  has_function_privilege('authenticated', 'public.notify_list_status_change()'::regprocedure, 'EXECUTE') is false,
  'the notification trigger function is not callable by a signed-in user'
);

select test_assert(
  (select count(*) = 0 from pg_policies
   where schemaname = 'public' and tablename = 'notifications' and cmd <> 'SELECT'),
  'notifications have no client write policy at all'
);

\echo '=== Phase 8 notification assertions passed ==='
