-- archive_list (20260904130000) clears a list's notifications when it is
-- manually deleted, but set_list_completed archives a list too (the
-- normal "mark done" path) and never did — every list ever finished
-- normally left its notifications behind, each pointing an "Open list"
-- link at a list that no longer appears anywhere. Brings that path to
-- the same behavior: nothing left on an archived list has any remaining
-- purpose, notifications included, regardless of which route got it there.

begin;

create or replace function public.set_list_completed(p_list_id uuid, p_completed boolean default true)
returns shopping_lists
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

    delete from notifications where list_id = p_list_id;
  else
    update shopping_lists sl
    set status = 'viewed', completed_at = null, updated_at = v_now,
        viewed_at = coalesce(sl.viewed_at, v_now)
    where sl.id = p_list_id
    returning * into v_list;
  end if;

  return v_list;
end;
$$;

-- Backfill: every notification already pointing at a list that is
-- already archived, from before this trigger point existed.
delete from notifications n
using shopping_lists sl
where sl.id = n.list_id
  and sl.status = 'archived';

commit;
