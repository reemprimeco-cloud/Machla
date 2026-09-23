-- Admin access by email, per-country sign-up counts, and an in-app
-- feedback box (2026-09-23 owner request).
--
-- WHY THE ADMIN CHECK MOVES TO A SHARED FUNCTION
--
-- `if not exists (select 1 from users where id = auth.uid() and
-- phone_number = '96565068000')` was copy-pasted into five separate RPCs
-- across three migrations. Phone is no longer a reliable identifier for
-- the operator either — Phase 2 of removing OTP
-- (20260920110000_phone_optional_identity.sql) means a brand-new account,
-- admin's own included, may never have one — so the owner asked to gate
-- by email instead. Changing five copies of the same literal in place is
-- exactly the situation a shared helper exists for; `is_admin_operator()`
-- replaces all five, and now accepts EITHER identifier, so the original
-- phone-based account keeps working if it's ever used to sign in again.
--
-- WHY COUNTRY IS A SIGN-UP FIELD, NOT INFERRED
--
-- Phone country code used to be a free signal (every account had a phone,
-- Kuwait's own +965 by convention). Opening sign-up worldwide with no
-- phone requirement at all removed that signal entirely, and this
-- project has no geo-IP lookup wired in anywhere. Asking at sign-up
-- (app/login/page.tsx) is the only reliable source left; existing
-- accounts simply have no value here; the admin page's country
-- breakdown groups them as "not specified" rather than guessing.
--
-- WHY FEEDBACK IS A TABLE PLUS RPC, NOT A THIRD-PARTY FORM
--
-- Every other write in this schema goes through a SECURITY DEFINER RPC
-- that checks auth.uid() (docs/architecture/10-security-model.md §1);
-- feedback follows the same shape rather than being the one exception —
-- an authenticated user can submit their own, and only the admin can
-- ever read any of it back.

begin;

-- ============================================================
-- 1. Country, from sign-up
-- ============================================================

alter table public.users
  add column if not exists country_code text;

comment on column public.users.country_code is
  'ISO 3166-1 alpha-2, chosen at sign-up (app/login/page.tsx) — null for '
  'every account created before this column existed, and for anyone who '
  'reached their account through completeAccountAction rather than '
  'signUpWithEmailAction/signUpWithUsernameAction. Never inferred.';

-- ============================================================
-- 2. One admin check, not five copies of one
-- ============================================================

create or replace function public.is_admin_operator()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from users
    where id = auth.uid()
      and (phone_number = '96565068000' or lower(email) = 'reemprimeco@gmail.com')
  );
end;
$$;

revoke all on function public.is_admin_operator() from public, anon;
grant execute on function public.is_admin_operator() to authenticated;

create or replace function public.admin_get_stats()
returns table(
  households bigint,
  workers bigint,
  owners_and_members bigint,
  total_users bigint,
  lists_draft bigint,
  lists_sent bigint,
  lists_viewed bigint,
  lists_completed bigint,
  lists_archived bigint,
  new_users_7d bigint,
  new_users_today bigint,
  ios_device_count bigint,
  subscriptions_paid bigint,
  subscriptions_comped bigint,
  subscriptions_trialing bigint,
  subscriptions_lapsed bigint,
  subscriptions_expired_or_revoked bigint
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    (select count(*) from households),
    (select count(distinct user_id) from household_members where role = 'worker' and status = 'active'),
    (select count(distinct user_id) from household_members where role in ('owner', 'member') and status = 'active'),
    (select count(*) from users),
    (select count(*) from shopping_lists where status = 'draft'),
    (select count(*) from shopping_lists where status = 'sent'),
    (select count(*) from shopping_lists where status = 'viewed'),
    (select count(*) from shopping_lists where status = 'completed'),
    (select count(*) from shopping_lists where status = 'archived'),
    (select count(*) from users where created_at > now() - interval '7 days'),
    (select count(*) from users
       where (created_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date),
    (select count(*) from push_subscriptions where platform = 'ios'),
    (select count(*) from households
       where subscription_status in ('active', 'grace_period')
         and apple_original_transaction_id is not null),
    (select count(*) from households
       where subscription_status in ('active', 'grace_period')
         and apple_original_transaction_id is null),
    (select count(*) from households
       where subscription_status = 'none' and now() < trial_ends_at),
    (select count(*) from households
       where subscription_status = 'none' and now() >= trial_ends_at),
    (select count(*) from households
       where subscription_status in ('expired', 'revoked'));
end;
$function$;

create or replace function public.admin_list_recent_subscriptions(p_limit int default 20)
returns table(
  household_id uuid,
  household_name text,
  owner_phone text,
  owner_name text,
  subscription_status text,
  apple_linked boolean,
  period_end timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select
    h.id,
    h.name,
    u.phone_number,
    u.display_name,
    h.subscription_status,
    h.apple_original_transaction_id is not null,
    h.subscription_period_end,
    h.updated_at
  from households h
  join users u on u.id = h.owner_user_id
  where h.subscription_status <> 'none'
  order by h.updated_at desc
  limit p_limit;
end;
$function$;

create or replace function public.admin_list_recent_users(p_limit int default 20)
returns table(
  id uuid,
  display_name text,
  phone_number text,
  email text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select u.id, u.display_name, u.phone_number, u.email, u.created_at
  from users u
  order by u.created_at desc
  limit p_limit;
end;
$function$;

create or replace function public.admin_list_today_signups()
returns table(
  id uuid,
  display_name text,
  phone_number text,
  email text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select u.id, u.display_name, u.phone_number, u.email, u.created_at
  from users u
  where (u.created_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date
  order by u.created_at desc;
end;
$function$;

create or replace function public.admin_list_lapsed_trials()
returns table(
  household_id uuid,
  household_name text,
  owner_name text,
  owner_phone text,
  owner_email text,
  trial_ended_at timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select h.id, h.name, u.display_name, u.phone_number, u.email, h.trial_ends_at
  from households h
  join users u on u.id = h.owner_user_id
  where h.subscription_status = 'none' and now() >= h.trial_ends_at
  order by h.trial_ends_at asc;
end;
$function$;

-- ============================================================
-- 3. Sign-ups by country
-- ============================================================

create or replace function public.admin_get_country_stats()
returns table(
  country_code text,
  signups bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select u.country_code, count(*)
  from users u
  group by u.country_code
  order by count(*) desc;
end;
$$;

revoke all on function public.admin_get_country_stats() from public, anon;
grant execute on function public.admin_get_country_stats() to authenticated;

-- ============================================================
-- 4. Feedback
-- ============================================================

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id),
  message text not null,
  created_at timestamptz not null default now()
);

comment on table public.app_feedback is
  'Free-text suggestions submitted from the in-app Feedback screen '
  '(components/feedback/FeedbackScreen.tsx). Write-only for an ordinary '
  'user — submit_feedback() is the only way in, admin_list_feedback() '
  'the only way to read any of it back.';

alter table public.app_feedback enable row level security;

-- No policy grants anything to `authenticated` directly — every access
-- goes through one of the two SECURITY DEFINER functions below, same as
-- the rest of this schema.

create or replace function public.submit_feedback(p_message text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_message text := btrim(coalesce(p_message, ''));
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if v_message = '' or char_length(v_message) > 4000 then
    raise exception 'INVALID_MESSAGE' using errcode = '22023';
  end if;

  insert into app_feedback (user_id, message)
  values (v_user_id, v_message)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.submit_feedback(text) from public, anon;
grant execute on function public.submit_feedback(text) to authenticated;

create or replace function public.admin_list_feedback(p_limit int default 100)
returns table(
  id uuid,
  message text,
  created_at timestamptz,
  display_name text,
  phone_number text,
  email text,
  country_code text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select f.id, f.message, f.created_at,
         u.display_name, u.phone_number, u.email, u.country_code
  from app_feedback f
  join users u on u.id = f.user_id
  order by f.created_at desc
  limit p_limit;
end;
$$;

revoke all on function public.admin_list_feedback(int) from public, anon;
grant execute on function public.admin_list_feedback(int) to authenticated;

commit;
