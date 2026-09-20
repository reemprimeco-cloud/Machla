-- Admin page: reach people directly. Adds `email` to the two existing
-- "list of users" RPCs (so the admin UI can offer a mailto: link once an
-- account has one — Phase 1 of removing OTP,
-- 20260919120000_email_password_identity.sql, means most accounts still
-- won't) and a new admin_list_lapsed_trials() RPC — the actual list of
-- who admin_get_stats() has only ever counted as subscriptionsLapsed
-- (free trial ended, never subscribed), by name and phone, so the owner
-- can reach out over WhatsApp instead of a push nobody but one of them
-- has enabled.
--
-- Both admin_list_recent_users() and admin_list_today_signups() are
-- changing their OUT parameter shape, which Postgres won't do in place
-- (42P13) -- drop and recreate, same as every previous stats migration.

drop function if exists public.admin_list_recent_users(int);

create function public.admin_list_recent_users(p_limit int default 20)
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
  if not exists (
    select 1 from users
    where id = auth.uid()
      and phone_number = '96565068000'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select u.id, u.display_name, u.phone_number, u.email, u.created_at
  from users u
  order by u.created_at desc
  limit p_limit;
end;
$function$;

revoke all on function public.admin_list_recent_users(int) from public, anon;
grant execute on function public.admin_list_recent_users(int) to authenticated;

drop function if exists public.admin_list_today_signups();

create function public.admin_list_today_signups()
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
  if not exists (
    select 1 from users
    where id = auth.uid()
      and phone_number = '96565068000'
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select u.id, u.display_name, u.phone_number, u.email, u.created_at
  from users u
  where (u.created_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date
  order by u.created_at desc;
end;
$function$;

revoke all on function public.admin_list_today_signups() from public, anon;
grant execute on function public.admin_list_today_signups() to authenticated;

-- Every household whose free trial ended without ever subscribing --
-- the actual names/phones behind admin_get_stats()'s subscriptionsLapsed
-- count, oldest lapse first (the ones waiting longest are the most
-- overdue for a nudge).
create function public.admin_list_lapsed_trials()
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
  if not exists (
    select 1 from users
    where id = auth.uid()
      and phone_number = '96565068000'
  ) then
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

revoke all on function public.admin_list_lapsed_trials() from public, anon;
grant execute on function public.admin_list_lapsed_trials() to authenticated;
