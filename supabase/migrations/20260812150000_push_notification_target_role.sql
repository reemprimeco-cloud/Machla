-- get_pending_pushes needs to tell the caller which route the recipient
-- can actually reach: /home/lists/{id} for an owner/member, /worker/lists
-- for a worker. list_sent recipients are always owner/member (the
-- trigger only inserts those rows), but list_viewed/list_completed go
-- back to created_by_user_id — which is a worker in the ordinary case,
-- but can be an owner/member themselves when they built and sent the
-- list through their own basket (app/home/shop, 08-route-map.md §4.2).
-- Getting this wrong sends a push that opens to a page the recipient's
-- role can't reach (the same bug NotificationsScreen's in-app "Open
-- list" link had — components/notifications/NotificationsScreen.tsx).

begin;

drop function if exists public.get_pending_pushes(uuid, text);

create or replace function public.get_pending_pushes(p_list_id uuid, p_type text)
returns table (
  notification_id uuid,
  user_id uuid,
  endpoint text,
  p256dh text,
  auth_key text,
  actor_name text,
  preferred_language text,
  is_household_side boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  return query
  select
    n.id,
    n.user_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth_key,
    n.actor_name,
    u.preferred_language,
    exists (
      select 1
      from household_members hm
      where hm.household_id = n.household_id
        and hm.user_id = n.user_id
        and hm.status = 'active'
        and hm.role in ('owner', 'member')
    )
  from notifications n
  join push_subscriptions ps on ps.user_id = n.user_id
  join users u on u.id = n.user_id
  where n.list_id = p_list_id
    and n.type = p_type
    and n.actor_user_id = auth.uid()
    and n.pushed_at is null;
end;
$$;

revoke all on function public.get_pending_pushes(uuid, text) from public, anon;
grant execute on function public.get_pending_pushes(uuid, text) to authenticated;

commit;
