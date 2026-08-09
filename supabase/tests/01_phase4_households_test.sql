-- HomeList — Phase 4 test suite: households, invitations, membership.
--
-- Covers the Phase 4 acceptance criteria ("a worker can join ONLY
-- through a valid invitation"; "multiple workers and members can belong
-- to one household") and the security scenarios the master plan lists
-- under Phase 10, exercised directly against Postgres rather than
-- through the UI — because that is the layer the guarantees actually
-- live in (docs/architecture/10-security-model.md §1).
--
-- Run after 00_test_harness.sql and both migrations. Any failure aborts
-- the run (psql -v ON_ERROR_STOP=1).

\pset pager off

-- ============================================================
-- Fixtures
-- ============================================================

select test_create_user('11111111-0000-0000-0000-000000000001', '+96500000001'); -- owner A
select test_create_user('11111111-0000-0000-0000-000000000002', '+96500000002'); -- member A
select test_create_user('11111111-0000-0000-0000-000000000003', '+96500000003'); -- worker A1
select test_create_user('11111111-0000-0000-0000-000000000004', '+96500000004'); -- worker A2
select test_create_user('22222222-0000-0000-0000-000000000001', '+96500000011'); -- owner B
select test_create_user('33333333-0000-0000-0000-000000000001', '+96500000021'); -- outsider

\echo ''
\echo '=== 1. Household creation ==='

select test_login('11111111-0000-0000-0000-000000000001');
select create_household('Reem''s Home') as household_a \gset

select test_assert(
  (select count(*) = 1 from households where id = :'household_a'),
  'create_household creates the household'
);

select test_assert(
  (select role = 'owner' and status = 'active'
   from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000001'),
  'creator becomes the active owner'
);

select test_assert(
  (select role = 'owner' from users where id = '11111111-0000-0000-0000-000000000001'),
  'users.role persona hint set to owner'
);

select test_raises(
  $$ select create_household('   ') $$,
  'INVALID_NAME',
  'blank household name is rejected'
);

select test_raises(
  $$ select create_household(repeat('x', 81)) $$,
  'INVALID_NAME',
  'over-long household name is rejected'
);

select test_login(null);
select test_raises(
  $$ select create_household('Anonymous Home') $$,
  'AUTH_REQUIRED',
  'an unauthenticated caller cannot create a household'
);

-- Second household, different owner — used throughout for isolation tests.
select test_login('22222222-0000-0000-0000-000000000001');
select create_household('Other Home') as household_b \gset

select test_assert(
  :'household_a' <> :'household_b',
  'two independent households exist'
);

\echo ''
\echo '=== 2. Invitation creation (owner-only) ==='

select test_login('33333333-0000-0000-0000-000000000001');
select test_raises(
  format($$ select create_invitation(%L::uuid, 'worker') $$, :'household_a'),
  'NOT_OWNER',
  'non-member cannot create an invitation'
);

select test_login('22222222-0000-0000-0000-000000000001');
select test_raises(
  format($$ select create_invitation(%L::uuid, 'worker') $$, :'household_a'),
  'NOT_OWNER',
  'owner of another household cannot invite into this one'
);

select test_login('11111111-0000-0000-0000-000000000001');

select test_raises(
  format($$ select create_invitation(%L::uuid, 'owner') $$, :'household_a'),
  'INVALID_ROLE',
  'cannot mint an owner invitation (one owner per household)'
);

select test_raises(
  format($$ select create_invitation(%L::uuid, 'admin') $$, :'household_a'),
  'INVALID_ROLE',
  'unknown role is rejected'
);

select test_raises(
  format($$ select create_invitation(%L::uuid, 'worker', 90) $$, :'household_a'),
  'INVALID_EXPIRY',
  'out-of-range expiry is rejected'
);

select code as worker_code from create_invitation(:'household_a', 'worker') \gset

select test_assert(length(:'worker_code') = 8, 'invitation code is 8 characters');

select test_assert(
  :'worker_code' !~ '[ILOU]',
  'invitation code avoids ambiguous letters I/L/O/U'
);

select test_assert(
  position(:'worker_code' in upper(replace(:'household_a', '-', ''))) = 0,
  'invitation code is not a slice of the household id'
);

select test_assert(
  (select status = 'pending' and max_uses = 1 and expires_at > now()
   from household_invitations where code = :'worker_code'),
  'invitation is pending, single-use, and unexpired'
);

\echo ''
\echo '=== 3. Preview (leaks nothing to non-holders) ==='

select test_login('11111111-0000-0000-0000-000000000003'); -- worker A1

select test_assert(
  (select household_name = 'Reem''s Home' and role = 'worker'
   from preview_invitation(:'worker_code')),
  'preview returns household name and offered role'
);

select test_assert(
  (select count(*) = 0 from preview_invitation('ZZZZZZZZ')),
  'preview of an unknown code returns nothing (no error distinction)'
);

-- The same code as a human would type it: lowercase, hyphenated, with
-- the classic 0/O and 1/I confusions substituted in.
select test_assert(
  (select count(*) = 1 from preview_invitation(
     lower(substr(translate(:'worker_code', '01', 'OI'), 1, 4) || '-' ||
           substr(translate(:'worker_code', '01', 'OI'), 5, 4))
  )),
  'preview normalizes lowercase, hyphens, and O/0 I/1 confusion'
);

\echo ''
\echo '=== 4. Acceptance ==='

select accept_invitation(:'worker_code') as joined_household \gset

select test_assert(
  :'joined_household' = :'household_a',
  'accept_invitation returns the joined household id'
);

select test_assert(
  (select role = 'worker' and status = 'active'
   from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000003'),
  'worker is now an active member with the invited role'
);

select test_assert(
  (select status = 'accepted'
     and used_by_user_id = '11111111-0000-0000-0000-000000000003'
     and used_at is not null
   from household_invitations where code = :'worker_code'),
  'invitation is marked accepted with an audit trail'
);

select test_assert(
  (select role = 'worker' from users where id = '11111111-0000-0000-0000-000000000003'),
  'users.role persona hint set to worker'
);

\echo ''
\echo '=== 5. Single-use, expiry, revocation ==='

-- "Worker A cannot reuse a single-use invitation."
select test_login('11111111-0000-0000-0000-000000000004'); -- worker A2
select test_raises(
  format($$ select accept_invitation(%L) $$, :'worker_code'),
  'INVITATION_NOT_PENDING',
  'a used invitation cannot be redeemed again'
);

select test_assert(
  (select count(*) = 0 from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000004'),
  'the second redeemer gained no membership'
);

-- "Worker A cannot use an expired invitation."
select test_login('11111111-0000-0000-0000-000000000001');
select code as expired_code from create_invitation(:'household_a', 'worker') \gset
update household_invitations set expires_at = now() - interval '1 day' where code = :'expired_code';

select test_login('11111111-0000-0000-0000-000000000004');
select test_assert(
  (select count(*) = 0 from preview_invitation(:'expired_code')),
  'expired invitation does not preview'
);
select test_raises(
  format($$ select accept_invitation(%L) $$, :'expired_code'),
  'INVITATION_EXPIRED',
  'expired invitation cannot be redeemed'
);

-- Revocation takes effect immediately — no cached-preview loophole.
select test_login('11111111-0000-0000-0000-000000000001');
select code as revoked_code, id as revoked_id from create_invitation(:'household_a', 'worker') \gset

select test_login('11111111-0000-0000-0000-000000000004');
select test_assert(
  (select count(*) = 1 from preview_invitation(:'revoked_code')),
  'invitation previews while still pending'
);

select test_login('11111111-0000-0000-0000-000000000003'); -- a worker, not the owner
select test_raises(
  format($$ select revoke_invitation(%L::uuid) $$, :'revoked_id'),
  'NOT_OWNER',
  'a worker cannot revoke an invitation'
);

select test_login('11111111-0000-0000-0000-000000000001');
select revoke_invitation(:'revoked_id');

select test_login('11111111-0000-0000-0000-000000000004');
select test_assert(
  (select count(*) = 0 from preview_invitation(:'revoked_code')),
  'revoked invitation stops previewing immediately'
);
select test_raises(
  format($$ select accept_invitation(%L) $$, :'revoked_code'),
  'INVITATION_NOT_PENDING',
  'revoked invitation cannot be redeemed'
);

-- "Worker A cannot join a household without a valid invitation."
select test_raises(
  $$ select accept_invitation('QQQQQQQQ') $$,
  'INVALID_CODE',
  'a made-up code cannot be redeemed'
);

select test_login(null);
select test_raises(
  $$ select preview_invitation('QQQQQQQQ') $$,
  'AUTH_REQUIRED',
  'an unauthenticated caller cannot even probe codes'
);

\echo ''
\echo '=== 6. Multiple members and workers in one household ==='

select test_login('11111111-0000-0000-0000-000000000001');
select code as member_code from create_invitation(:'household_a', 'member') \gset
select code as worker2_code from create_invitation(:'household_a', 'worker') \gset

select test_login('11111111-0000-0000-0000-000000000002');
select accept_invitation(:'member_code');
select test_login('11111111-0000-0000-0000-000000000004');
select accept_invitation(:'worker2_code');

select test_assert(
  (select count(*) = 4 from household_members
   where household_id = :'household_a' and status = 'active'),
  'one household holds an owner, a member, and two workers'
);

select test_assert(
  (select count(*) = 2 from household_members
   where household_id = :'household_a' and status = 'active' and role = 'worker'),
  'multiple workers coexist in one household'
);

-- Accepting again while already a member is a friendly no-op, not a
-- duplicate row and not a burned invitation.
select test_login('11111111-0000-0000-0000-000000000001');
select code as spare_code from create_invitation(:'household_a', 'member') \gset
select test_login('11111111-0000-0000-0000-000000000002');
select accept_invitation(:'spare_code');
select test_assert(
  (select count(*) = 1 from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000002'),
  'accepting while already a member creates no duplicate row'
);
select test_assert(
  (select status = 'pending' from household_invitations where code = :'spare_code'),
  'and does not silently burn the invitation'
);

\echo ''
\echo '=== 7. Roster visibility (no phone numbers, workers excluded) ==='

select test_login('11111111-0000-0000-0000-000000000001');
select test_assert(
  (select count(*) = 4 from get_household_members(:'household_a')),
  'owner sees the full roster'
);

select test_login('11111111-0000-0000-0000-000000000002'); -- member
select test_assert(
  (select count(*) = 4 from get_household_members(:'household_a')),
  'member sees the full roster'
);

select test_login('11111111-0000-0000-0000-000000000003'); -- worker
select test_raises(
  format($$ select * from get_household_members(%L::uuid) $$, :'household_a'),
  'FORBIDDEN',
  'worker cannot list the household roster'
);

select test_login('22222222-0000-0000-0000-000000000001'); -- owner of B
select test_raises(
  format($$ select * from get_household_members(%L::uuid) $$, :'household_a'),
  'FORBIDDEN',
  'another household''s owner cannot list this roster'
);

-- Structural, not incidental: the function's declared result type has no
-- phone column at all, so no caller can obtain one through it.
select test_assert(
  position('phone' in pg_get_function_result('get_household_members(uuid)'::regprocedure)) = 0,
  'roster function signature exposes no phone number'
);

\echo ''
\echo '=== 8. Removal ==='

select test_login('11111111-0000-0000-0000-000000000003'); -- worker
select test_raises(
  format($$ select remove_household_member(%L::uuid, %L::uuid) $$,
         :'household_a', '11111111-0000-0000-0000-000000000004'),
  'NOT_OWNER',
  'a worker cannot remove another member'
);

select test_login('11111111-0000-0000-0000-000000000002'); -- member
select test_raises(
  format($$ select remove_household_member(%L::uuid, %L::uuid) $$,
         :'household_a', '11111111-0000-0000-0000-000000000004'),
  'NOT_OWNER',
  'a member cannot remove a worker (owner-only action)'
);

select test_login('11111111-0000-0000-0000-000000000001'); -- owner
select test_raises(
  format($$ select remove_household_member(%L::uuid, %L::uuid) $$,
         :'household_a', '11111111-0000-0000-0000-000000000001'),
  'CANNOT_REMOVE_OWNER',
  'the owner cannot remove themselves (household never loses its owner)'
);

select remove_household_member(:'household_a', '11111111-0000-0000-0000-000000000004');

select test_assert(
  (select status = 'removed' from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000004'),
  'removal is a soft delete (row retained for list history)'
);

-- "Removed worker loses access immediately."
select test_login('11111111-0000-0000-0000-000000000004');
select test_assert(
  is_active_member(:'household_a') is false,
  'removed worker is no longer an active member'
);

select test_login('11111111-0000-0000-0000-000000000001');
select test_assert(
  (select count(*) = 3 from get_household_members(:'household_a')),
  'removed worker disappears from the roster'
);

-- Re-inviting a removed worker reactivates rather than colliding with
-- the (household_id, user_id) unique constraint.
select code as reinvite_code from create_invitation(:'household_a', 'worker') \gset
select test_login('11111111-0000-0000-0000-000000000004');
select accept_invitation(:'reinvite_code');
select test_assert(
  (select status = 'active' and role = 'worker' from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000004'),
  're-invited worker is reactivated, not duplicated'
);
select test_assert(
  (select count(*) = 1 from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000004'),
  'no duplicate membership row was created'
);

\echo ''
\echo '=== 9. Cross-household isolation under RLS ==='

-- Everything above ran as superuser, which bypasses RLS. From here the
-- session acts as `authenticated`, so the policies are genuinely in
-- force — this is the layer a client holding the anon key would hit.

set role authenticated;

select test_login('11111111-0000-0000-0000-000000000003'); -- worker, household A only
select test_assert(
  (select count(*) = 1 from households),
  'worker sees exactly one household — their own'
);
select test_assert(
  (select count(*) = 0 from households where id = :'household_b'),
  'worker in A cannot see household B'
);
select test_assert(
  (select count(*) = 1 from household_members),
  'worker sees only their own membership row, not the roster'
);
select test_assert(
  (select count(*) = 0 from household_invitations),
  'worker cannot read any invitation rows'
);

select test_login('11111111-0000-0000-0000-000000000001'); -- owner of A
select test_assert(
  (select count(*) = 4 from household_members where household_id = :'household_a'),
  'owner sees every membership row in their household'
);
select test_assert(
  (select count(*) = 0 from household_members where household_id = :'household_b'),
  'owner of A sees no membership rows from household B'
);
select test_assert(
  (select count(*) > 0 from household_invitations where household_id = :'household_a'),
  'owner can read their own household''s invitations'
);
select test_assert(
  (select count(*) = 0 from household_invitations where household_id = :'household_b'),
  'owner of A cannot read household B''s invitations'
);

select test_login('33333333-0000-0000-0000-000000000001'); -- outsider, no household
select test_assert(
  (select count(*) = 0 from households),
  'a user with no membership discovers no households at all'
);

\echo ''
\echo '=== 10. No direct write path bypasses the RPCs ==='

-- INSERT against a table with no INSERT policy raises outright.
select test_login('11111111-0000-0000-0000-000000000003');

select test_raises(
  format($$ insert into household_members (household_id, user_id, role, status)
            values (%L::uuid, %L::uuid, 'worker', 'active') $$,
         :'household_b', '11111111-0000-0000-0000-000000000003'),
  'row-level security',
  'a client cannot insert itself into a household directly'
);

select test_raises(
  $$ insert into households (name, owner_user_id)
     values ('Sneaky Home', '11111111-0000-0000-0000-000000000003') $$,
  'row-level security',
  'a client cannot create a household outside create_household()'
);

select test_raises(
  format($$ insert into household_invitations
              (household_id, code, role, created_by_user_id, expires_at)
            values (%L::uuid, 'FAKECODE', 'owner', %L::uuid, now() + interval '1 year') $$,
         :'household_a', '11111111-0000-0000-0000-000000000003'),
  'row-level security',
  'a client cannot mint its own invitation row'
);

-- UPDATE/DELETE against a table with no matching policy is NOT an error:
-- RLS simply makes zero rows visible to write. So these assert that the
-- data is unchanged afterwards, which is the property that actually
-- matters — an error would be a weaker guarantee than a silent no-op.
update household_members set role = 'owner'
where household_id = :'household_a'
  and user_id = '11111111-0000-0000-0000-000000000003';

select test_assert(
  (select role = 'worker' from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000003'),
  'a worker cannot escalate their own role by direct update'
);

delete from household_members
where household_id = :'household_a'
  and user_id = '11111111-0000-0000-0000-000000000003';

select test_assert(
  (select count(*) = 1 from household_members
   where household_id = :'household_a'
     and user_id = '11111111-0000-0000-0000-000000000003'),
  'a worker cannot delete their own membership row'
);

update household_invitations set expires_at = now() + interval '10 years';
update households set name = 'Renamed By Worker';

reset role;

select test_assert(
  (select name = 'Reem''s Home' from households where id = :'household_a'),
  'a worker cannot rename the household by direct update'
);

select test_assert(
  (select count(*) = 0 from household_invitations
   where expires_at > now() + interval '5 years'),
  'a worker cannot extend invitation expiry by direct update'
);

\echo ''
\echo '=== 11. Users table isolation ==='

set role authenticated;
select test_login('11111111-0000-0000-0000-000000000003');

select test_assert(
  (select count(*) = 1 from users),
  'a user can read only their own profile row'
);

select test_assert(
  (select phone_number = '+96500000003' from users),
  'and that row is their own'
);

-- Fellow household members' phone numbers are never reachable, even
-- though they share a household (10-security-model.md §3).
select test_assert(
  (select count(*) = 0 from users
   where id = '11111111-0000-0000-0000-000000000001'),
  'a worker cannot read the owner''s profile row'
);

reset role;

\echo ''
\echo '=== 12. Scheduled expiry sweep ==='

select test_login('11111111-0000-0000-0000-000000000001');
select code as sweep_code from create_invitation(:'household_a', 'worker') \gset
update household_invitations set expires_at = now() - interval '1 hour' where code = :'sweep_code';

select test_assert(
  (select expire_stale_invitations() >= 1),
  'expire_stale_invitations flips overdue pending invitations'
);

select test_assert(
  (select status = 'expired' from household_invitations where code = :'sweep_code'),
  'the swept invitation is now marked expired'
);

select test_assert(
  (select status = 'accepted' from household_invitations where code = :'worker_code'),
  'the sweep leaves already-accepted invitations alone'
);

\echo ''
\echo '======================================'
\echo ' Phase 4 test suite: ALL CHECKS PASSED'
\echo '======================================'
