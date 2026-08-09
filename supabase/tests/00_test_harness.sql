-- HomeList — test harness for running the schema against a plain
-- PostgreSQL instance (no Supabase).
--
-- Supabase provides `auth.users`, `auth.uid()`, and the `anon` /
-- `authenticated` roles. This file stubs the minimum equivalent so the
-- migrations in supabase/migrations/ can be applied and exercised
-- locally — including Row Level Security, which needs a non-superuser
-- role to be meaningful.
--
-- Usage (see supabase/tests/README.md):
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/00_test_harness.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/migrations/<each>.sql
--   psql -v ON_ERROR_STOP=1 -f supabase/tests/01_phase4_households_test.sql

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  phone text
);

-- Supabase derives auth.uid() from the request JWT. Locally we read the
-- same GUC name PostgREST uses, so tests can switch identity with
-- select set_config('request.jwt.claim.sub', '<uuid>', false).
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;

-- Mirror Supabase's default table privileges. RLS — not the absence of
-- grants — is what actually restricts these roles, which is precisely
-- what the Phase 4 tests need to verify.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;

-- Mirror Supabase's default *function* privileges too. This one matters:
-- Supabase grants EXECUTE on new functions in `public` directly to
-- `anon` and `authenticated`, on top of PostgreSQL's own implicit grant
-- to PUBLIC. A migration that revokes from only one of those paths
-- leaves the function callable — which is exactly how
-- `expire_stale_invitations()` shipped to a live project reachable by
-- anyone holding the (public) anon key. Modelling it here means the
-- privilege assertions in the test suite catch that locally instead.
alter default privileges in schema public
  grant execute on functions to anon, authenticated;

-- ---- assertion helpers -------------------------------------------

create or replace function test_ok(p_label text)
returns void language plpgsql as $$
begin
  raise notice 'PASS — %', p_label;
end;
$$;

create or replace function test_assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_condition is not true then
    raise exception 'FAIL — %', p_label;
  end if;
  raise notice 'PASS — %', p_label;
end;
$$;

-- Asserts that `p_sql` raises, and (optionally) that the message matches
-- p_expect. Used for every "this must be forbidden" case.
create or replace function test_raises(p_sql text, p_expect text, p_label text)
returns void language plpgsql as $$
declare
  v_message text;
begin
  begin
    execute p_sql;
  exception when others then
    v_message := SQLERRM;
  end;

  if v_message is null then
    raise exception 'FAIL — % (expected an error, none raised)', p_label;
  end if;

  if p_expect is not null and position(p_expect in v_message) = 0 then
    raise exception 'FAIL — % (expected "%", got "%")', p_label, p_expect, v_message;
  end if;

  raise notice 'PASS — % [%]', p_label, v_message;
end;
$$;

-- Switch the acting identity (what auth.uid() returns).
create or replace function test_login(p_user_id uuid)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(p_user_id::text, ''), false);
end;
$$;

-- Create an auth.users row (which fires the handle_new_user trigger,
-- populating public.users exactly as a real OTP signup would).
create or replace function test_create_user(p_id uuid, p_phone text)
returns uuid language plpgsql as $$
begin
  insert into auth.users (id, phone) values (p_id, p_phone);
  return p_id;
end;
$$;
