-- ============================================================
-- Phase 2 of removing OTP: phone is no longer required.
-- ============================================================
--
-- This directly reverses the decision written down in
-- 20260810120000_phone_only_identity.sql -- re-reading that file's own
-- "THE DECISION" section is the right context for why this one exists.
-- At the time, phone+OTP was this app's only sign-in method, and a
-- phone-less signup meant a stray "Email provider" account nobody asked
-- for, colliding with everyone else on phone_number's placeholder ''.
--
-- Phase 1 (20260919120000_email_password_identity.sql) added email and
-- username alongside phone without removing anything -- OTP kept
-- working throughout, so existing accounts had a way to add a password
-- first. This migration is the actual cutover, made together with the
-- app code change that removes phone+OTP from /login entirely
-- (app/login/page.tsx, lib/auth/signUp.ts): a brand-new sign-up from
-- here on IS phone-less by construction (email+password, or a worker's
-- username+password via a synthetic email), so the OLD rejection would
-- now reject every normal sign-up instead of only a stray one.
--
-- Existing rows keep whatever phone_number they already have -- this
-- does not touch data, only the constraint and the trigger that used to
-- enforce it.
--
-- The original collision risk (two accounts both landing on '') cannot
-- recur: phone_number is nullable now, and Postgres allows any number of
-- NULLs under a UNIQUE constraint, unlike the placeholder '' it used to
-- coalesce to. A lighter defensive check replaces the old one: reject
-- only the case that would mean the database itself has no way to name
-- the account at all (neither phone nor email) -- keeping the project's
-- standing rule that identity integrity lives here, not in a dashboard
-- toggle.

alter table public.users alter column phone_number drop not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.phone is null and new.email is null then
    raise exception 'IDENTITY_REQUIRED'
      using hint = 'Machla accounts need at least a phone or an email.';
  end if;

  insert into public.users (id, phone_number, email)
  values (new.id, new.phone, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Mirrors a new auth.users row into public.users. phone_number and '
  'email are both nullable now -- rejects only a signup with neither '
  '(see 20260920110000_phone_optional_identity.sql). This app''s own '
  'sign-up (lib/auth/signUp.ts) always sets one or the other before '
  'creating the auth.users row.';
