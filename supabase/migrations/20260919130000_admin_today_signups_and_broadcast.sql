-- Admin page additions: "who signed up today" + iOS device reach.
--
-- Extends admin_get_stats() (20260906190000_admin_stats_subscriptions.sql,
-- itself extending the original 20260828162132_admin_stats never
-- committed to this repo) with two more numbers the admin page now
-- shows: new_users_today (Asia/Kuwait calendar day — this app's one real
-- market, same convention as lib/household/greeting.ts) and
-- ios_device_count (how many APNs-reachable devices a broadcast from the
-- new "communication" section would actually reach).
--
-- admin_list_today_signups() is a dedicated RPC rather than filtering
-- admin_list_recent_users()'s already-limited 20 rows client-side: at
-- this app's scale that would happen to work, but it would silently
-- under-count the day a bigger sign-up spike ever mattered enough to
-- check.
--
-- The OUT parameter shape of admin_get_stats() is changing again, which
-- Postgres won't do in place (42P13) -- drop and recreate, same as last
-- time.
drop function if exists public.admin_get_stats();

create function public.admin_get_stats()
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
  if not exists (
    select 1 from users
    where id = auth.uid()
      and phone_number = '96565068000'
  ) then
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

revoke all on function public.admin_get_stats() from public, anon;
grant execute on function public.admin_get_stats() to authenticated;

-- Everyone whose account was created today, Kuwait calendar day, newest
-- first -- the admin page's own "من سجل اليوم" section.
create function public.admin_list_today_signups()
returns table(
  id uuid,
  display_name text,
  phone_number text,
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
  select u.id, u.display_name, u.phone_number, u.created_at
  from users u
  where (u.created_at at time zone 'Asia/Kuwait')::date = (now() at time zone 'Asia/Kuwait')::date
  order by u.created_at desc;
end;
$function$;

revoke all on function public.admin_list_today_signups() from public, anon;
grant execute on function public.admin_list_today_signups() to authenticated;
