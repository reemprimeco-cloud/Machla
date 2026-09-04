-- 20260812160000_archive_completed_lists.sql made completing a list
-- archive it immediately, so no read path should ever surface a
-- 'completed' row — but get_household_lists' WHERE clause only excluded
-- 'draft' and 'archived', leaving 'completed' itself still visible. Four
-- lists from 2026-08-12 are stuck exactly there (completed via a path
-- that bypassed set_list_completed, likely a direct data edit during
-- that session, never advancing to 'archived') and have lingered in the
-- household's list inbox and dashboard ever since — reported by the
-- owner as old "done" lists that will not go away.
--
-- Fixes both the stray data and the read path, so this cannot recur:
-- 'completed' is now excluded the same way 'archived' already is.

begin;

update shopping_lists
set status = 'archived', updated_at = now()
where status = 'completed';

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
    and sl.status not in ('draft', 'archived', 'completed')
    and (p_list_id is null or sl.id = p_list_id)
    -- A Worker sees their own history and nothing else.
    and (v_household_side or sl.created_by_user_id = v_user_id)
  group by sl.id, u.display_name
  order by sl.sent_at desc nulls last, sl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

commit;
