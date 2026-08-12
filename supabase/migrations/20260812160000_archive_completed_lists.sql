-- Completing a list now archives it: it disappears from every list
-- view — the household dashboard, the household's list inbox, and the
-- worker's own sent-list history all read through get_household_lists —
-- and there is no way back to it, from either side (owner-requested
-- behavior, 2026-08).
--
-- The schema always had an 'archived' status distinct from 'completed'
-- (0001_phase1_foundation.sql's check constraint), and
-- assert_can_work_list already refused to let anyone act on an archived
-- list (LIST_ARCHIVED) — this migration is what actually reaches that
-- state and hides it, which nothing did before.
--
-- The row and its items are NOT deleted, only excluded from every read
-- path: soft-archiving is reversible (a future admin/support need) in a
-- way a delete is not, and it keeps shopping_list_items' history intact
-- for anything that might join against it later (analytics, disputes).

begin;

-- Reaching 'completed' still fires the existing notification trigger
-- (notify_list_status_change, 20260809200000_phase8_notifications.sql)
-- exactly as before — the worker who sent the list still hears about it.
-- The second update to 'archived' is a status the trigger has no branch
-- for, so it creates no notification of its own; it just ends the list's
-- visible life immediately after.
create or replace function public.set_list_completed(
  p_list_id uuid,
  p_completed boolean default true
)
returns public.shopping_lists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list shopping_lists := assert_can_work_list(p_list_id);
  v_now timestamptz := now();
begin
  if p_completed then
    update shopping_lists sl
    set status = 'completed', completed_at = v_now, updated_at = v_now,
        viewed_at = coalesce(sl.viewed_at, v_now)
    where sl.id = p_list_id;

    update shopping_lists sl
    set status = 'archived', updated_at = v_now
    where sl.id = p_list_id
    returning * into v_list;
  else
    -- Unreachable through the UI once a list is archived —
    -- assert_can_work_list refuses to return an archived list at all —
    -- kept only so a caller that somehow still holds a pre-archive
    -- reference gets a clear error rather than nothing.
    update shopping_lists sl
    set status = 'viewed', completed_at = null, updated_at = v_now,
        viewed_at = coalesce(sl.viewed_at, v_now)
    where sl.id = p_list_id
    returning * into v_list;
  end if;

  return v_list;
end;
$$;

-- Excludes archived lists unconditionally — even a direct p_list_id
-- lookup (a stale bookmark, a notification's "Open list" link) finds
-- nothing, which is the point: no route back to a finished list.
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
    and sl.status not in ('draft', 'archived')
    and (p_list_id is null or sl.id = p_list_id)
    -- A Worker sees their own history and nothing else.
    and (v_household_side or sl.created_by_user_id = v_user_id)
  group by sl.id, u.display_name
  order by sl.sent_at desc nulls last, sl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

commit;
