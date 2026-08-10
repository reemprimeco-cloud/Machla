-- HomeList — Phase 8: making the two sides notice each other.
--
-- Master plan Phase 8: list status, viewed status, completed status,
-- in-app notification, read/unread state, notification preferences, and
-- list history (Amendment 1 §16A.10).
--
-- The goal it states is "make communication reliable", and that word
-- drove the main design choice: notifications are ROWS, created by a
-- database trigger on the status transition itself, not ephemeral
-- realtime events. A worker whose phone was off during the transition
-- still finds the notification waiting; nothing depends on a socket being
-- connected at the right moment. It is also the shape a future push or
-- WhatsApp channel needs — those become a reader of this table rather
-- than a second, parallel notification path that can disagree with it.
--
-- Browser push itself is listed as "optional" in the phase and is NOT
-- built here: it needs VAPID keys, a service-worker push handler, and a
-- permission prompt, none of which earn their place before anyone has
-- used the app.

begin;

-- ============================================================
-- Fix: a Worker may see only their OWN lists
-- ============================================================

-- 04-roles-permission-matrix.md is explicit — "View any list belonging to
-- the household: Owner yes, Member yes, Worker no (own lists only,
-- master plan Section 15)" — and 10-security-model.md §5 says
-- worker-to-worker visibility is "deliberately not granted in V1".
--
-- The Phase 1 policy did not implement that. `is_active_member(household_id)`
-- alone let any active member, Worker included, read every list in the
-- household. Phase 8 is where it starts to matter (a worker now gets a
-- list-history screen), so the policy is corrected to match the approved
-- matrix rather than the matrix quietly relaxed to match the code.
drop policy if exists shopping_lists_select_member on public.shopping_lists;
create policy shopping_lists_select_member on public.shopping_lists
  for select using (
    public.is_active_member(household_id, array['owner', 'member'])
    or created_by_user_id = auth.uid()
  );

drop policy if exists shopping_list_items_select_member on public.shopping_list_items;
create policy shopping_list_items_select_member on public.shopping_list_items
  for select using (
    exists (
      select 1
      from public.shopping_lists sl
      where sl.id = list_id
        and (
          public.is_active_member(sl.household_id, array['owner', 'member'])
          or sl.created_by_user_id = auth.uid()
        )
    )
  );

-- get_household_lists is SECURITY DEFINER and so bypasses the policies
-- above; it has to apply the same rule itself or it would be a way around
-- them. Recreated in full rather than patched, so the two rules sit in
-- one place in the file history.
create or replace function public.get_household_lists(
  p_household_id uuid,
  p_list_id uuid default null,
  p_limit int default 50
)
returns table (
  id uuid,
  status text,
  language text,
  created_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  created_by_user_id uuid,
  created_by_name text,
  total_items bigint,
  purchased_items bigint,
  unavailable_items bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_side boolean;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not is_active_member(p_household_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_household_side := is_active_member(p_household_id, array['owner', 'member']);

  return query
  select
    sl.id,
    sl.status,
    sl.language,
    sl.created_at,
    sl.sent_at,
    sl.viewed_at,
    sl.completed_at,
    sl.created_by_user_id,
    u.display_name,
    count(sli.id),
    count(sli.id) filter (where sli.purchase_status = 'purchased'),
    count(sli.id) filter (where sli.purchase_status = 'unavailable')
  from shopping_lists sl
  join users u on u.id = sl.created_by_user_id
  left join shopping_list_items sli on sli.list_id = sl.id
  where sl.household_id = p_household_id
    and sl.status <> 'draft'
    and (p_list_id is null or sl.id = p_list_id)
    -- A Worker sees their own history and nothing else.
    and (v_household_side or sl.created_by_user_id = v_user_id)
  group by sl.id, u.display_name
  order by sl.sent_at desc nulls last, sl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ============================================================
-- Notification preferences
-- ============================================================

-- jsonb rather than three boolean columns: a future channel (push, email,
-- WhatsApp) adds keys instead of a migration, and the default is
-- everything-on so a user who never opens settings still gets told.
alter table public.users
  add column if not exists notification_preferences jsonb not null
  default '{"list_sent": true, "list_viewed": true, "list_completed": true}'::jsonb;

comment on column public.users.notification_preferences is
  'Per-type in-app notification switches. A missing key means enabled, so '
  'adding a new notification type does not silently mute it for every '
  'existing user.';

-- ============================================================
-- Notifications
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid references public.shopping_lists (id) on delete cascade,
  type text not null check (type in ('list_sent', 'list_viewed', 'list_completed')),
  actor_user_id uuid references public.users (id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- actor_name is a SNAPSHOT, not a join. Two reasons: `users` is scoped by
-- RLS to the caller's own row, so rendering "Maria sent a list" from a
-- live join would need another SECURITY DEFINER function; and a
-- notification should still read correctly after the actor leaves the
-- household.
comment on column public.notifications.actor_name is
  'Display name of the person who caused this notification, captured when '
  'it was created. Deliberately denormalized so reading a notification '
  'needs no privileged lookup and survives the actor being removed.';

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index if not exists notifications_user_recent_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Own rows only, and read-only from the client: creation is the trigger's
-- job and marking-read goes through an RPC, so there is no way to forge a
-- notification or to mark someone else's as read.
create policy notifications_select_own on public.notifications
  for select using (user_id = auth.uid());

-- ============================================================
-- Creating them
-- ============================================================

-- A trigger rather than inserts inside each RPC: the notification then
-- cannot be forgotten by a future code path that changes a list's status,
-- and it fires in the same transaction as the change, so the two can
-- never disagree.
create or replace function public.notify_list_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_type text;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if new.status = 'sent' then
    v_type := 'list_sent';
  elsif new.status = 'viewed' then
    v_type := 'list_viewed';
  elsif new.status = 'completed' then
    v_type := 'list_completed';
  else
    return new;
  end if;

  select display_name into v_actor_name from users u where u.id = v_actor;

  if v_type = 'list_sent' then
    -- Everyone who can act on it. Workers are not told about another
    -- worker's list — they cannot open it either (policy above).
    insert into notifications (user_id, household_id, list_id, type, actor_user_id, actor_name)
    select hm.user_id, new.household_id, new.id, v_type, v_actor, v_actor_name
    from household_members hm
    join users u on u.id = hm.user_id
    where hm.household_id = new.household_id
      and hm.status = 'active'
      and hm.role in ('owner', 'member')
      -- Never notify the person who performed the action.
      and hm.user_id is distinct from v_actor
      and coalesce((u.notification_preferences ->> v_type)::boolean, true);
  else
    -- viewed / completed go back to whoever wrote the list.
    insert into notifications (user_id, household_id, list_id, type, actor_user_id, actor_name)
    select new.created_by_user_id, new.household_id, new.id, v_type, v_actor, v_actor_name
    from users u
    where u.id = new.created_by_user_id
      and new.created_by_user_id is distinct from v_actor
      and coalesce((u.notification_preferences ->> v_type)::boolean, true);
  end if;

  return new;
end;
$$;

drop trigger if exists shopping_lists_notify_trigger on public.shopping_lists;
create trigger shopping_lists_notify_trigger
  after update of status on public.shopping_lists
  for each row execute function public.notify_list_status_change();

-- ============================================================
-- Read state and preferences
-- ============================================================

-- Marks the caller's own notifications read. Passing null marks all of
-- them, which is what opening the notifications screen does.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_count int;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- The user_id filter is what makes this safe to expose: an id belonging
  -- to someone else simply matches nothing.
  update notifications n
  set read_at = now()
  where n.user_id = v_user_id
    and n.read_at is null
    and (p_ids is null or n.id = any (p_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.set_notification_preference(
  p_type text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_prefs jsonb;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if p_type is null or p_type not in ('list_sent', 'list_viewed', 'list_completed') then
    raise exception 'INVALID_TYPE' using errcode = '22023';
  end if;

  update users u
  set notification_preferences =
        coalesce(u.notification_preferences, '{}'::jsonb)
        || jsonb_build_object(p_type, coalesce(p_enabled, true)),
      updated_at = now()
  where u.id = v_user_id
  returning notification_preferences into v_prefs;

  return v_prefs;
end;
$$;

-- ============================================================
-- Privileges — anon executes nothing (10-security-model.md §5B)
-- ============================================================

revoke all on function public.notify_list_status_change() from public, anon, authenticated;
revoke all on function public.mark_notifications_read(uuid[]) from public, anon;
revoke all on function public.set_notification_preference(text, boolean) from public, anon;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
grant execute on function public.set_notification_preference(text, boolean) to authenticated;

commit;
