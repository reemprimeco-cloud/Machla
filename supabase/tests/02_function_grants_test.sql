-- HomeList — function EXECUTE privilege assertions.
--
-- Guards the mistake documented in
-- supabase/migrations/*_phase4_function_grants.sql: a `revoke ... from
-- public` looks like it locks a function down, but Supabase *also*
-- grants EXECUTE directly to `anon` and `authenticated`, and
-- has_function_privilege() is true if the privilege arrives by either
-- path. The original Phase 4 migration revoked only from PUBLIC, so
-- every RPC — including the unauthenticated maintenance sweep
-- expire_stale_invitations() — stayed callable through
-- /rest/v1/rpc/<name> by anyone holding the anon key.
--
-- These assertions are deliberately about *privileges*, not behaviour.
-- The behavioural tests in 01_*.sql pass either way, because each RPC
-- also checks auth.uid() internally; only a privilege check catches a
-- function that has no internal check of its own.

\pset pager off

\echo ''
\echo '=== Function EXECUTE privileges ==='

-- "Application function" = defined by these migrations, as opposed to:
--   * extension members (pgcrypto etc.) — their grants are the
--     extension's business, and on Supabase they live in the
--     `extensions` schema rather than `public` anyway;
--   * the test_* helpers, which exist only in this harness.
-- Scoping matters: without it this assertion fires on pgcrypto and on
-- its own helpers, which says nothing about HomeList's security.
create or replace view app_functions as
  select p.oid, p.proname, p.proconfig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname not like 'test\_%'
    and p.proname <> 'app_functions'
    and not exists (
      select 1 from pg_depend d
      where d.objid = p.oid and d.deptype = 'e'
    );

-- No application function may be callable anonymously.
select test_assert(
  (select count(*) = 0 from app_functions f
   where has_function_privilege('anon', f.oid, 'EXECUTE')),
  'anon can execute no application function'
);

-- Functions with no internal authorization check must not be reachable
-- with a user JWT either.
select test_assert(
  has_function_privilege('authenticated', 'public.expire_stale_invitations()'::regprocedure, 'EXECUTE') is false,
  'authenticated cannot execute expire_stale_invitations (no internal auth check)'
);

select test_assert(
  has_function_privilege('authenticated', 'public.handle_new_user()'::regprocedure, 'EXECUTE') is false,
  'authenticated cannot execute handle_new_user (trigger-only)'
);

select test_assert(
  has_function_privilege('authenticated', 'public.generate_invitation_code()'::regprocedure, 'EXECUTE') is false,
  'authenticated cannot execute generate_invitation_code (internal helper)'
);

-- The user-facing RPCs must stay callable by signed-in users, or the app
-- breaks. Asserted so a future over-zealous revoke is caught too.
select test_assert(
  has_function_privilege('authenticated', 'public.create_household(text)'::regprocedure, 'EXECUTE'),
  'authenticated can execute create_household'
);
select test_assert(
  has_function_privilege('authenticated', 'public.create_invitation(uuid, text, int)'::regprocedure, 'EXECUTE'),
  'authenticated can execute create_invitation'
);
select test_assert(
  has_function_privilege('authenticated', 'public.revoke_invitation(uuid)'::regprocedure, 'EXECUTE'),
  'authenticated can execute revoke_invitation'
);
select test_assert(
  has_function_privilege('authenticated', 'public.preview_invitation(text)'::regprocedure, 'EXECUTE'),
  'authenticated can execute preview_invitation'
);
select test_assert(
  has_function_privilege('authenticated', 'public.accept_invitation(text)'::regprocedure, 'EXECUTE'),
  'authenticated can execute accept_invitation'
);
select test_assert(
  has_function_privilege('authenticated', 'public.remove_household_member(uuid, uuid)'::regprocedure, 'EXECUTE'),
  'authenticated can execute remove_household_member'
);
select test_assert(
  has_function_privilege('authenticated', 'public.get_household_members(uuid)'::regprocedure, 'EXECUTE'),
  'authenticated can execute get_household_members'
);

-- is_active_member backs every RLS policy; without EXECUTE the policies
-- themselves fail for signed-in users.
select test_assert(
  has_function_privilege('authenticated', 'public.is_active_member(uuid, text[])'::regprocedure, 'EXECUTE'),
  'authenticated can execute is_active_member (required by RLS policies)'
);

\echo ''
\echo '=== search_path pinned on every function ==='

-- An unpinned search_path on a SECURITY DEFINER function lets the caller
-- influence name resolution inside it.
select test_assert(
  (select count(*) = 0 from app_functions f
   where f.proconfig is null
      or not exists (select 1 from unnest(f.proconfig) c where c like 'search_path=%')),
  'every application function pins its search_path'
);

\echo ''
\echo '=============================================='
\echo ' Function grant suite: ALL CHECKS PASSED'
\echo '=============================================='
