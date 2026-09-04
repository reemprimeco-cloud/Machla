-- Lets a household owner/member manually remove a received list from
-- view (swipe-to-delete on the household's list inbox/dashboard),
-- rather than only ever reaching 'archived' as a side effect of
-- completing it (20260812160000_archive_completed_lists.sql).
--
-- Reuses assert_can_work_list for authorization: same rule as every
-- other household-side list action (owner/member only, not the Worker
-- who sent it, and refuses an already-draft or already-archived list).
-- Archiving is the existing, already-reversible-in-principle mechanism
-- for "this list's visible life is over" — a real DELETE of the row
-- would orphan shopping_list_items and any historical reference to it,
-- which archiving deliberately avoids.
--
-- Also clears every notification tied to the list: once it is gone from
-- every list view, a notification whose "Open list" link points at it
-- would lead nowhere, for every recipient, not just the caller.

begin;

create or replace function public.archive_list(p_list_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list shopping_lists := assert_can_work_list(p_list_id);
begin
  update shopping_lists
  set status = 'archived', updated_at = now()
  where id = p_list_id;

  delete from notifications where list_id = p_list_id;
end;
$$;

revoke all on function public.archive_list(uuid) from public, anon;
grant execute on function public.archive_list(uuid) to authenticated;

commit;
