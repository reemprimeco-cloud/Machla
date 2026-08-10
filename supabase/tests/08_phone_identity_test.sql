-- ============================================================
-- Phone-only identity (20260810120000_phone_only_identity.sql)
-- ============================================================
--
-- The bug this locks down was invisible for eleven phases because the
-- only login path always supplies a phone. It became reachable the
-- moment a second auth provider was enabled on the project, and it
-- failed on the SECOND phone-less account, not the first — so a smoke
-- test that created one user would have passed.
--
-- Each assertion below therefore has a matching control: the phone path
-- must still work, or a trigger that rejected everything would look
-- identical to a trigger that rejects the right things.

\set ON_ERROR_STOP on

\echo '--- 1. The phone path still works (control) ---'

select test_create_user('cc000000-0000-0000-0000-000000000001', '+96590000001');
select test_create_user('cc000000-0000-0000-0000-000000000002', '+96590000002');

select test_assert(
  (select count(*) = 2 from public.users
    where id in ('cc000000-0000-0000-0000-000000000001',
                 'cc000000-0000-0000-0000-000000000002')),
  'two ordinary phone signups both mirror into public.users'
);

select test_assert(
  (select phone_number = '+96590000001' from public.users
    where id = 'cc000000-0000-0000-0000-000000000001'),
  'and the phone is stored verbatim, not coalesced'
);

\echo '--- 2. A phone-less signup is refused ---'

select test_raises(
  $$ insert into auth.users (id, phone) values ('cc000000-0000-0000-0000-000000000003', null) $$,
  'PHONE_REQUIRED',
  'a signup with no phone (what enabling Email auth makes reachable) is rejected'
);

select test_raises(
  $$ insert into auth.users (id, phone) values ('cc000000-0000-0000-0000-000000000004', '   ') $$,
  'PHONE_REQUIRED',
  'and so is a whitespace-only phone, which would trim to the same sentinel'
);

\echo '--- 3. The refusal is total, not first-one-wins ---'
-- This is the assertion that would have caught the original bug. Before
-- the fix, the FIRST of these succeeded (taking phone_number = '') and
-- only the second raised unique_violation.

select test_raises(
  $$ insert into auth.users (id, phone) values ('cc000000-0000-0000-0000-000000000005', null) $$,
  'PHONE_REQUIRED',
  'the second phone-less signup fails the same way as the first'
);

select test_assert(
  (select count(*) = 0 from public.users where phone_number = ''),
  'no user row was ever created holding the empty-string sentinel'
);

select test_assert(
  (select count(*) = 0 from auth.users
    where id in ('cc000000-0000-0000-0000-000000000003',
                 'cc000000-0000-0000-0000-000000000004',
                 'cc000000-0000-0000-0000-000000000005')),
  'and the rejected auth.users rows rolled back rather than orphaning'
);

\echo '=== Phone identity assertions passed ==='
