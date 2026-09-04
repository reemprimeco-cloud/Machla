-- Manual "clear notifications" button for the notifications screen.
-- Notifications otherwise only ever disappear as a side effect of their
-- list being archived (on completion or manual delete) — this lets
-- someone clear their own inbox directly, same auth.uid() scoping as
-- mark_notifications_read, so passing another user's ids simply matches
-- nothing.

begin;

create or replace function public.clear_notifications()
returns integer
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

  delete from notifications n where n.user_id = v_user_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.clear_notifications() from public, anon;
grant execute on function public.clear_notifications() to authenticated;

commit;
