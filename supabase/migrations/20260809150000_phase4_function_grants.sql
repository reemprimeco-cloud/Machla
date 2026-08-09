-- HomeList — Phase 4 follow-up: lock down function EXECUTE privileges.
--
-- Why this exists
-- ---------------
-- The Phase 4 migration ended with `revoke execute ... from public`,
-- intending to make the RPCs callable only by signed-in users. That was
-- ineffective on Supabase: Supabase's default privileges grant EXECUTE
-- on functions in `public` **directly to the `anon` and `authenticated`
-- roles**, not via `PUBLIC`. Revoking from `PUBLIC` therefore removed a
-- grant that was never the one doing the work, and every function stayed
-- callable by `anon` through `/rest/v1/rpc/<name>`.
--
-- That was only a latent problem for the RPCs that check `auth.uid()`
-- themselves (they refuse an anonymous caller with AUTH_REQUIRED), but
-- it was a live one for `expire_stale_invitations()`, which has no such
-- check by design — it is a maintenance sweep. Anyone holding the anon
-- key (which is public: it ships in the browser bundle) could POST to it
-- and mark every pending invitation across every household as expired.
-- Denial of service on the entire invitation system.
--
-- Fix: revoke explicitly from `anon` and, where the function is not
-- meant to be called from the app at all, from `authenticated` too.
--
-- The local test harness (supabase/tests/00_test_harness.sql) now mirrors
-- Supabase's function default privileges so this class of mistake fails
-- the suite instead of reaching a live project.

begin;

-- ---- search_path hardening on the two helpers that lacked it --------
-- Neither touches a table, but pinning search_path at definition time
-- removes any dependence on the caller's search_path.

create or replace function public.generate_invitation_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(alphabet, floor(random() * 32)::int + 1, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.normalize_invitation_code(p_code text)
returns text
language sql
immutable
set search_path = public
as $$
  select translate(
    regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'),
    'OIL',
    '011'
  );
$$;

-- ---- Never callable from the client API -----------------------------
--
-- Every revoke below names `public` as well as the two roles. EXECUTE
-- can be held via either path — a direct grant to `anon`/`authenticated`
-- (Supabase's default) or the implicit grant to `PUBLIC` that every new
-- function gets — and `has_function_privilege` is true if *either*
-- applies. Revoking only one leaves the privilege in place, which is
-- exactly how the original attempt failed.

-- Maintenance sweep: no internal authorization check, so it must not be
-- reachable with an anon or user JWT. Intended callers are pg_cron or a
-- service_role job (both bypass these grants).
revoke all on function public.expire_stale_invitations() from public, anon, authenticated;

-- Trigger function. Meaningless outside its AFTER INSERT context on
-- auth.users, and never something a client should invoke. The trigger
-- itself is unaffected: PostgreSQL checks EXECUTE when the trigger is
-- created, and the insert is performed by supabase_auth_admin regardless.
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- Internal helper used only inside create_invitation().
revoke all on function public.generate_invitation_code() from public, anon, authenticated;

-- ---- Signed-in users only -------------------------------------------
-- These are SECURITY DEFINER on purpose: each one performs its own
-- auth.uid()/role check internally, which is what makes them safe to
-- expose to `authenticated` (docs/architecture/10-security-model.md §1).
-- They must not be reachable anonymously.

revoke all on function public.create_household(text) from public, anon;
revoke all on function public.create_invitation(uuid, text, int) from public, anon;
revoke all on function public.revoke_invitation(uuid) from public, anon;
revoke all on function public.preview_invitation(text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.remove_household_member(uuid, uuid) from public, anon;
revoke all on function public.get_household_members(uuid) from public, anon;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.create_invitation(uuid, text, int) to authenticated;
grant execute on function public.revoke_invitation(uuid) to authenticated;
grant execute on function public.preview_invitation(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.remove_household_member(uuid, uuid) to authenticated;
grant execute on function public.get_household_members(uuid) to authenticated;

-- is_active_member backs the RLS policies, so `authenticated` must keep
-- EXECUTE or every policy that calls it fails. `anon` loses it: the only
-- anon-readable tables (categories, products) have `using (true)`
-- policies that never call it, so this fails closed with no cost.
revoke all on function public.is_active_member(uuid, text[]) from public, anon, authenticated;
grant execute on function public.is_active_member(uuid, text[]) to authenticated;

-- Pure string helper, no data access — harmless either way, but there is
-- no reason for an anonymous caller to have it.
revoke all on function public.normalize_invitation_code(text) from public, anon, authenticated;
grant execute on function public.normalize_invitation_code(text) to authenticated;

commit;
