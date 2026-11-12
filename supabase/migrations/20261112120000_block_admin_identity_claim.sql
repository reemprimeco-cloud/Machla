-- Machla — block self-service claiming of the admin operator's identifiers.
--
-- is_admin_operator() (20260923120000_admin_country_and_feedback.sql) and
-- lib/admin/guard.ts's isAdminUser() both decide "is this the admin" from
-- public.users.email / public.users.phone_number. But users_update_own
-- (20260809210000_phase10_performance.sql) restricts only WHICH row a
-- caller may update, not which columns, and `authenticated` holds
-- column-level UPDATE on both. So any signed-in account could run
--   update users set email = 'reemprimeco@gmail.com' where id = auth.uid()
-- straight through PostgREST and pass both admin checks. Nothing stopped
-- it: no row held that email, so users_email_lower_unique_idx never
-- fired (2026-11-12 security audit, verified against the live project).
--
-- This trigger closes that path without touching any legitimate flow: a
-- row may keep a reserved identifier it already has, but no row may newly
-- acquire one through an INSERT or UPDATE. Nobody but the operator ever
-- has a reason to hold these values, so signup / completeAccount /
-- setDisplayName are unaffected.
--
-- Stopgap, not the end state: the durable fix is to stop deriving admin
-- status from columns the user can write at all.

begin;

create or replace function public.prevent_admin_identity_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_email constant text := 'reemprimeco@gmail.com';
  v_admin_phone constant text := '96565068000';
  v_had_email boolean := false;
  v_had_phone boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_had_email := old.email is not null and lower(old.email) = v_admin_email;
    v_had_phone := old.phone_number is not null and old.phone_number = v_admin_phone;
  end if;

  if new.email is not null and lower(new.email) = v_admin_email and not v_had_email then
    raise exception 'RESERVED_IDENTIFIER' using errcode = '42501';
  end if;

  if new.phone_number is not null and new.phone_number = v_admin_phone and not v_had_phone then
    raise exception 'RESERVED_IDENTIFIER' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_admin_identity_claim() from public, anon, authenticated;

drop trigger if exists prevent_admin_identity_claim on public.users;
create trigger prevent_admin_identity_claim
  before insert or update of email, phone_number on public.users
  for each row execute function public.prevent_admin_identity_claim();

commit;
