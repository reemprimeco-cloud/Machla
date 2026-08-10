-- ============================================================
-- Phone is the identity. Enforce it at the trigger.
-- ============================================================
--
-- WHY THIS EXISTS
--
-- `handle_new_user` mirrored every new `auth.users` row into
-- `public.users` with `coalesce(new.phone, '')`. Every user arriving
-- through the app's only login path has a phone, so the coalesce never
-- fired — until the Email auth provider was found enabled on the
-- project, which makes a phone-less signup reachable.
--
-- Measured against the live project rather than reasoned about:
--
--   1st email signup  -> succeeded, users.phone_number = ''
--   2nd email signup  -> FAILED, unique_violation on users.phone_number
--
-- `phone_number` is NOT NULL and UNIQUE, so `''` is a sentinel that
-- exactly one account can hold. The first phone-less signup silently
-- takes it; every later one dies inside the trigger, which rolls back
-- the `auth.users` insert and surfaces as a 500 with no explanation.
--
-- THE DECISION (this affects authentication, so it is written down
-- rather than assumed — Phase 0 standing rule)
--
-- Three options were available:
--
--   (a) Make `phone_number` nullable and store NULL. Postgres allows
--       many NULLs under a UNIQUE constraint, so the collision goes
--       away. Rejected: it admits users the rest of the application
--       cannot describe. `06-auth-otp-flow.md` §2 makes the phone the
--       identity, and the invitation and household flows all assume a
--       user can be named by one.
--
--   (b) Refuse the signup. Chosen. The app is phone-only by design and
--       says so (§6, "No email/password option"). A signup with no
--       phone is not a user this product has a meaning for, and failing
--       at the door is honest where a NULL row is a slow leak.
--
--   (c) Rely on the Email provider staying disabled. Rejected on the
--       same principle as everything else here: integrity belongs in
--       the database, not in a dashboard toggle that anyone with
--       project access can flip without seeing this consequence.
--
-- (b) does NOT make (c) unnecessary — the Email provider should still be
-- disabled, because it is an account-creation surface with no cost
-- barrier, unlike SMS. This migration makes that a defence-in-depth
-- choice rather than the only thing standing between the schema and a
-- corrupt row.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Identity is the phone number (06-auth-otp-flow.md §2). Anything
  -- arriving without one came from a provider this application does not
  -- support, and there is no sensible row to write for it.
  if new.phone is null or btrim(new.phone) = '' then
    raise exception 'PHONE_REQUIRED'
      using hint = 'HomeList accounts are phone-only. Disable non-phone auth providers.';
  end if;

  insert into public.users (id, phone_number)
  values (new.id, new.phone)
  on conflict (id) do nothing;

  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Mirrors a new auth.users row into public.users. Rejects phone-less '
  'signups: phone is the identity, and users.phone_number is NOT NULL '
  'UNIQUE, so a placeholder would collide on the second such account.';
