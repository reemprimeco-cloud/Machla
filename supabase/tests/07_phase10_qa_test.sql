-- HomeList — Phase 10: QA & security hardening.
--
-- Phase 10 is production readiness, and most of its checklist is already
-- asserted in files 01-06. This file adds what was genuinely missing and,
-- more usefully, asserts a few STRUCTURAL invariants — properties that
-- hold over the whole schema rather than over one function, so a future
-- migration that breaks them fails here rather than in production.
--
-- Traceability for the master plan's six named security scenarios:
--
--   1. Worker A cannot access Household B      → 01 §7, 04 §4, 06 §7
--   2. Worker A cannot use an expired invite   → 01 (expired_code)
--   3. Worker A cannot reuse a single-use one  → 01 (reuse)
--   4. Removed worker loses access immediately → 01 (removed worker), + below
--   5. Member cannot perform owner-only action → 01, + below
--   6. API cannot be bypassed via the frontend → §3 below (structural)

\pset pager off

\echo ''
\echo '=== Phase 10 — QA and security hardening ==='

-- ============================================================
-- 1. RLS policy hygiene (regression guard for the Phase 10 rewrite)
-- ============================================================

-- The Phase 10 migration rewrote every policy's bare `auth.uid()` as
-- `(select auth.uid())`, which turns a per-row re-evaluation into a
-- once-per-statement InitPlan. That is easy to undo by accident: a new
-- policy written the obvious way reintroduces it silently, and nothing
-- fails — it just gets slower as the table grows.
--
-- `auth.uid()` inside a function body is fine (is_active_member wraps its
-- own), so this only looks at the policy expressions themselves.
-- Implemented by removing every *wrapped* call first and then looking for
-- what is left, rather than with a negative lookbehind — Postgres regex
-- supports lookahead but not lookbehind, and the lookbehind version of
-- this assertion silently matched everything.
--
-- Postgres renders a wrapped call as `( SELECT auth.uid() AS uid)`.
select test_assert(
  (select count(*) = 0
   from pg_policies
   where schemaname = 'public'
     and (
       regexp_replace(coalesce(qual, ''), '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') like '%auth.uid()%'
       or regexp_replace(coalesce(with_check, ''), '\( SELECT auth\.uid\(\) AS uid\)', '', 'g') like '%auth.uid()%'
     )),
  'no RLS policy calls auth.uid() without wrapping it in a scalar subquery'
);

-- One permissive policy per table per action. Two of them means Postgres
-- evaluates both for every row and ORs the results — the same answer for
-- twice the work (Supabase lint 0006).
select test_assert(
  (select count(*) = 0
   from (
     select tablename, cmd, count(*) as n
     from pg_policies
     where schemaname = 'public' and permissive = 'PERMISSIVE'
     group by tablename, cmd
     having count(*) > 1
   ) duplicated),
  'no table has two permissive policies for the same action'
);

-- ============================================================
-- 2. Indexes the access paths actually depend on
-- ============================================================

select test_assert(
  (select count(*) = 4
   from pg_indexes
   where schemaname = 'public'
     and indexname in (
       'shopping_lists_created_by_idx',        -- the RLS policy filters on it
       'shopping_list_items_product_idx',      -- joined to render any list
       'shopping_list_items_category_idx',     -- grouping (§16A)
       'product_usage_stats_product_idx'       -- get_frequent_products
     )),
  'the four read-path foreign keys are indexed'
);

-- Phase 5 replaced keyword-array search with the maintained search_text
-- column; the old GIN index served nothing and cost on every import.
select test_assert(
  (select count(*) = 0 from pg_indexes
   where schemaname = 'public' and indexname = 'products_search_keywords_gin_idx'),
  'the superseded search_keywords index is gone'
);

select test_assert(
  (select count(*) = 1 from pg_indexes
   where schemaname = 'public' and indexname = 'products_search_text_trgm_idx'),
  'and the trigram index that replaced it is present'
);

-- ============================================================
-- 3. Scenario 6 — the API cannot be bypassed from the frontend
-- ============================================================

-- The structural version of that scenario, and the strongest single
-- statement in this suite: across the whole public schema there is
-- exactly ONE policy that permits a client write, and it is
-- `users_update_own` (a user editing their own display name).
--
-- Everything else — households, memberships, invitations, the catalogue,
-- lists, items, usage stats, notifications — has SELECT policies only, so
-- every mutation must go through a SECURITY DEFINER function that checks
-- auth.uid() itself. A future migration that adds a write policy anywhere
-- has to change this number, which makes it a deliberate act rather than
-- an oversight.
select test_assert(
  (select array_agg(tablename || '.' || policyname order by tablename)
   from pg_policies
   where schemaname = 'public' and cmd <> 'SELECT')
  = array['users.users_update_own'],
  'exactly one client write policy exists in the whole schema'
);

select test_assert(
  (select bool_and(rowsecurity)
   from pg_tables
   where schemaname = 'public'
     and tablename in ('users', 'households', 'household_members',
                       'household_invitations', 'categories', 'products',
                       'product_usage_stats', 'shopping_lists',
                       'shopping_list_items', 'notifications')),
  'row level security is enabled on every application table'
);

-- A table with RLS enabled and no policy at all is invisible rather than
-- open, but it is also almost certainly a mistake. This catches the
-- reverse of the above: a table nobody can read.
select test_assert(
  (select count(*) = 0
   from pg_tables t
   where t.schemaname = 'public'
     and t.rowsecurity
     and not exists (
       select 1 from pg_policies p
       where p.schemaname = 'public' and p.tablename = t.tablename
     )),
  'every RLS-enabled table has at least one policy'
);

-- ============================================================
-- 4. Duplicate submission
-- ============================================================

select test_create_user('aa000000-0000-0000-0000-000000000001', '+96500001001'); -- owner
select test_create_user('aa000000-0000-0000-0000-000000000002', '+96500001002'); -- worker
select test_create_user('aa000000-0000-0000-0000-000000000003', '+96500001003'); -- second worker

select test_login('aa000000-0000-0000-0000-000000000001');
select create_household('Phase 10 Home') as hh10 \gset

insert into public.categories (key, icon, sort_order, is_active,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values ('p10_cat', '📦', 930, true, 'P10','P','P','P','P','P','P','P','P');
select id as c10 from public.categories where key = 'p10_cat' \gset

insert into public.products (natural_key, category_id, unit, is_active, sort_order,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si)
values ('p10_x||1', :'c10', 'pcs', true, 9301, 'X','X','X','X','X','X','X','X','X');
select id as p10x from public.products where natural_key = 'p10_x||1' \gset

select test_login('aa000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh10'::uuid, 'worker') as inv \gset

set role authenticated;

-- The same person submitting the join form twice — a double-tap on a slow
-- connection, which is the realistic case, not an attack.
select test_login('aa000000-0000-0000-0000-000000000002');
select accept_invitation(:'code');

select test_raises(
  format($$ select accept_invitation(%L) $$, :'code'),
  'INVITATION_NOT_PENDING',
  'submitting the same invitation code twice fails the second time'
);

select test_assert(
  (select count(*) = 1 from household_members
   where household_id = :'hh10' and user_id = 'aa000000-0000-0000-0000-000000000002'),
  'and leaves exactly one membership row, not two'
);

-- A different person submitting a code that has already been consumed.
select test_login('aa000000-0000-0000-0000-000000000003');
select test_raises(
  format($$ select accept_invitation(%L) $$, :'code'),
  'INVITATION_NOT_PENDING',
  'a used code cannot be redeemed by someone else either'
);

-- Duplicate item submission: the stepper sets an absolute quantity, so a
-- repeated tap is idempotent rather than additive.
select test_login('aa000000-0000-0000-0000-000000000002');
select get_or_create_draft_list(:'hh10'::uuid, 'en') as l10 \gset

select set_list_item(:'l10'::uuid, :'p10x'::uuid, 3);
select set_list_item(:'l10'::uuid, :'p10x'::uuid, 3);
select set_list_item(:'l10'::uuid, :'p10x'::uuid, 3);

select test_assert(
  (select count(*) = 1 from shopping_list_items where list_id = :'l10'),
  'three identical add submissions produce one item'
);

select test_assert(
  (select quantity = 3 from shopping_list_items where list_id = :'l10'),
  'at the submitted quantity, not a multiple of it'
);

-- Duplicate send.
select send_list(:'l10'::uuid);
select test_raises(
  format($$ select send_list(%L::uuid) $$, :'l10'),
  'LIST_NOT_DRAFT',
  'a double-tapped send does not send twice'
);

-- Checked as the OWNER: a list_sent notification goes to the household
-- side, never back to the person who sent it.
select test_login('aa000000-0000-0000-0000-000000000001');

select test_assert(
  (select count(*) = 1 from notifications
   where list_id = :'l10' and type = 'list_sent'),
  'and produces exactly one notification'
);

-- Duplicate check-off: setting the same status twice is a no-op, not a
-- double-count in the progress figure.
select id as i10 from shopping_list_items where list_id = :'l10' \gset

select set_purchase_status(:'i10'::uuid, 'purchased');
select set_purchase_status(:'i10'::uuid, 'purchased');

select test_assert(
  (select purchased_items = 1 and total_items = 1
   from get_household_lists(:'hh10'::uuid, :'l10'::uuid)),
  'checking the same item off twice counts once'
);

-- ============================================================
-- 5. Scenarios 4 and 5, restated at the list layer
-- ============================================================

-- Scenario 5: a Member cannot perform an owner-only action. Asserted in
-- 01 for invitations; restated here because Phase 7 gave Members
-- checklist rights, and it is worth proving that did NOT leak into
-- household management.
select test_login('aa000000-0000-0000-0000-000000000001');
select code from create_invitation(:'hh10'::uuid, 'member') as inv2 \gset
select test_login('aa000000-0000-0000-0000-000000000003');
select accept_invitation(:'code');

select test_raises(
  format($$ select create_invitation(%L::uuid, 'worker') $$, :'hh10'),
  'NOT_OWNER',
  'a member with full checklist rights still cannot invite'
);

select test_raises(
  format($$ select remove_household_member(%L::uuid, %L::uuid) $$,
         :'hh10', 'aa000000-0000-0000-0000-000000000002'),
  'NOT_OWNER',
  'nor remove anyone'
);

-- Scenario 4: removal revokes list access in the same request, with no
-- session invalidation needed — the check is per-request and server-side.
select test_login('aa000000-0000-0000-0000-000000000001');
select remove_household_member(:'hh10'::uuid, 'aa000000-0000-0000-0000-000000000002');

select test_login('aa000000-0000-0000-0000-000000000002');
select test_assert(
  (select count(*) = 0 from shopping_lists where id = :'l10'),
  'a removed worker immediately loses sight of the list they themselves sent'
);

select test_raises(
  format($$ select get_or_create_draft_list(%L::uuid, 'en') $$, :'hh10'),
  'FORBIDDEN',
  'and cannot start a new one'
);

reset role;

\echo '=== Phase 10 QA assertions passed ==='
