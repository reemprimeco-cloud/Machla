-- HomeList — Phase 10: production readiness (performance).
--
-- Everything here is a performance change with NO change in who can see
-- what. That is the point worth stating up front: the whole SQL suite
-- (240 assertions) must pass unchanged afterwards, and it does. A
-- performance fix that quietly widens a policy would be the worst kind of
-- regression this project could ship, so each rewrite below is a
-- semantically identical restatement of the policy it replaces.
--
-- Driven by Supabase's own database linter (`get_advisors`), which
-- reported three real classes of problem and several false ones.

begin;

-- ============================================================
-- 1. auth.uid() re-evaluated per row  (lint 0003_auth_rls_initplan)
-- ============================================================

-- `auth.uid()` written bare in a policy is re-evaluated for EVERY row
-- scanned. Wrapped in a scalar subquery it becomes an InitPlan: evaluated
-- once per statement and reused. Identical semantics, and the difference
-- grows linearly with table size — which for shopping_list_items is the
-- table that grows fastest.
--
-- is_active_member(household_id, ...) is deliberately NOT wrapped: its
-- argument varies per row, so there is nothing to hoist. Its internal
-- auth.uid() is fixed below instead, which is where the win actually is.

create or replace function public.is_active_member(p_household_id uuid, p_roles text[] default null)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = (select auth.uid())
      and hm.status = 'active'
      and (p_roles is null or hm.role = any (p_roles))
  );
$$;

drop policy if exists users_select_own on public.users;
create policy users_select_own on public.users
  for select using (id = (select auth.uid()));

drop policy if exists users_update_own on public.users;
create policy users_update_own on public.users
  for update using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists product_usage_stats_select_own on public.product_usage_stats;
create policy product_usage_stats_select_own on public.product_usage_stats
  for select using (user_id = (select auth.uid()));

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select using (user_id = (select auth.uid()));

-- These two also carry the §5 security fix below — authorship is a
-- NARROWING condition on top of membership, never an alternative to it.
drop policy if exists shopping_lists_select_member on public.shopping_lists;
create policy shopping_lists_select_member on public.shopping_lists
  for select using (
    public.is_active_member(household_id)
    and (
      public.is_active_member(household_id, array['owner', 'member'])
      or created_by_user_id = (select auth.uid())
    )
  );

drop policy if exists shopping_list_items_select_member on public.shopping_list_items;
create policy shopping_list_items_select_member on public.shopping_list_items
  for select using (
    exists (
      select 1
      from public.shopping_lists sl
      where sl.id = list_id
        and public.is_active_member(sl.household_id)
        and (
          public.is_active_member(sl.household_id, array['owner', 'member'])
          or sl.created_by_user_id = (select auth.uid())
        )
    )
  );

-- ============================================================
-- 2. Two permissive policies on one table  (lint 0006)
-- ============================================================

-- Phase 4 split household_members SELECT into "your own membership rows"
-- and "the full roster if you are owner/member". Both are permissive, so
-- Postgres evaluates BOTH for every row and ORs the results — the same
-- answer one policy with an OR gives, for twice the work.
--
-- Merged. The comment that mattered is preserved here: the own-row half
-- exists because the root route needs to read the caller's own membership
-- to pick an experience, and a Worker must be able to do that without
-- being able to read the roster (04-roles-permission-matrix.md).
drop policy if exists household_members_select_own on public.household_members;
drop policy if exists household_members_select_roster on public.household_members;

create policy household_members_select_member on public.household_members
  for select using (
    user_id = (select auth.uid())
    or public.is_active_member(household_id, array['owner', 'member'])
  );

-- ============================================================
-- 3. Foreign keys with no covering index  (lint 0001)
-- ============================================================

-- Only the ones on a real query path or a cascade path. An index that
-- serves nothing is not free: it costs on every write, which for
-- shopping_list_items is the hot table.
--
-- On the read path:
create index if not exists shopping_lists_created_by_idx
  on public.shopping_lists (created_by_user_id);        -- the RLS policy above filters on this

create index if not exists shopping_list_items_product_idx
  on public.shopping_list_items (product_id);           -- joined when rendering any list

create index if not exists shopping_list_items_category_idx
  on public.shopping_list_items (category_id);          -- grouping (§16A)

create index if not exists product_usage_stats_product_idx
  on public.product_usage_stats (product_id);           -- joined by get_frequent_products

-- On the cascade path: deleting a household or a list has to find these
-- rows, and without an index that is a sequential scan of the whole table.
create index if not exists notifications_household_idx
  on public.notifications (household_id);

create index if not exists notifications_list_idx
  on public.notifications (list_id);

create index if not exists household_members_invited_by_idx
  on public.household_members (invited_by_user_id);

create index if not exists household_invitations_created_by_idx
  on public.household_invitations (created_by_user_id);

-- Deliberately NOT indexed: households.owner_user_id (one row per
-- household, and the members table is the real access path),
-- products.subcategory_id (unused in V1), and the three attribution
-- columns — notifications.actor_user_id,
-- shopping_list_items.purchased_by_user_id and
-- household_invitations.used_by_user_id (never filtered on, and
-- `on delete set null` does not need an index to be correct, only to be
-- fast on a rare admin action).

-- ============================================================
-- 4. A genuinely redundant index  (lint 0005_unused_index)
-- ============================================================

-- products_search_keywords_gin_idx dates from Phase 1, when search was
-- going to run over the search_keywords array. Phase 5 replaced that with
-- the maintained search_text column and its trigram index, and nothing
-- queries search_keywords directly any more — the keywords are folded
-- INTO search_text by trigger. So this one is dead weight on every
-- catalogue import.
--
-- The other "unused index" the linter reports, notifications_user_unread_idx,
-- is kept: it is unused because the table is empty, not because the query
-- that needs it does not exist.
drop index if exists public.products_search_keywords_gin_idx;

commit;

-- ============================================================
-- 5. SECURITY FIX — a removed worker kept their own lists
-- ============================================================
--
-- Applied in §1 above; recorded here because it is the important change in
-- this migration and would otherwise read as a performance tweak.
--
-- Found by 07_phase10_qa_test.sql, and introduced by Phase 8. Phase 8
-- correctly tightened list visibility so a Worker sees only their own
-- lists, by adding an `or created_by_user_id = auth.uid()` branch. That
-- branch carried NO membership condition — so once a worker was removed
-- from the household, is_active_member went false while
-- `created_by_user_id = auth.uid()` stayed true, and they could still read
-- every list they had ever sent.
--
-- It contradicted the model directly: 10-security-model.md §5 says
-- "status='removed' is checked by is_active_member on every policy —
-- access is gone the instant the row updates". It was, on the ordinary
-- path; the authorship shortcut went around it.
--
-- The shape to keep: an "or mine" clause must narrow an access rule, never
-- widen it. Read the policy as — you must be an active member AT ALL, and
-- then either you are on the household side or it is your own list.
