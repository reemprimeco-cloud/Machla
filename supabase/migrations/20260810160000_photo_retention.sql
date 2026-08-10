-- ============================================================
-- Photographs are temporary: purged once the item is bought
-- ============================================================
--
-- A photographed item exists to answer one question — "is this the thing
-- you meant?" — and that question is settled the moment the item is
-- ticked off. Keeping the picture after that stores images taken inside
-- someone's home for no remaining purpose.
--
-- THIS REVERSES A CHOICE MADE IN THE PREVIOUS MIGRATION.
--
-- `20260810140000_photo_items.sql` deliberately gave clients no DELETE
-- policy on the objects, reasoning that a photograph attached to a sent
-- list is a record of what was asked for and should not be alterable.
-- That reasoning holds for *substitution* — swapping one picture for
-- another after the fact — but it was the wrong call for *retention*,
-- which is a data-minimisation question, not an integrity one. The
-- product requirement is that the picture does not outlive its purpose.
--
-- The two concerns are reconciled by what is kept: the item row, its
-- quantity, its note and its purchase status all survive untouched, so
-- the history of what was requested and what happened to it is intact.
-- Only the blob goes.
--
-- WHY THE ROW KEEPS photo_path
--
-- `shopping_list_items_product_xor_photo` requires a photographed item to
-- have a path — nulling it would turn the row into a constraint
-- violation, and giving it a product id would be a lie. The path is
-- therefore kept as the record of what was there, and
-- `photo_deleted_at` marks that the object behind it is gone. The UI
-- reads that flag and renders "photo unavailable" instead of a broken
-- image.
--
-- WHY DELETION IS NOT DONE HERE
--
-- Supabase forbids `delete from storage.objects` outright
-- (storage.protect_delete: "Use the Storage API instead"), so a Postgres
-- trigger cannot purge the blob no matter how convenient that would be.
-- The delete happens through the Storage API in the server action that
-- ticks the item off, using the caller's own session — which is why the
-- DELETE policy below exists and why it is scoped to household
-- membership.

begin;

alter table public.shopping_list_items
  add column if not exists photo_deleted_at timestamptz;

comment on column public.shopping_list_items.photo_deleted_at is
  'When the photograph behind photo_path was purged, which happens once '
  'the item is purchased. The row and its path are kept so the list '
  'stays a complete record; only the image is gone.';

-- ============================================================
-- Stamping the purge
-- ============================================================

create or replace function public.mark_photo_purged(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select sl.household_id into v_household_id
  from shopping_list_items sli
  join shopping_lists sl on sl.id = sli.list_id
  where sli.id = p_item_id and sli.photo_path is not null;

  -- ONE refusal for both "no such item" and "not your household". This
  -- function is SECURITY DEFINER, so it can see every row in the table;
  -- distinguishing the two would turn it into an oracle telling any
  -- signed-in caller which item ids exist. Same rule, and the same
  -- reasoning, as assert_own_draft's LIST_NOT_FOUND.
  --
  -- Any active member may record the purge, because any of them may have
  -- been the one shopping. The blob deletion itself is authorized
  -- separately, by the storage policy, against the same membership.
  if v_household_id is null or not is_active_member(v_household_id) then
    raise exception 'ITEM_NOT_FOUND' using errcode = '22023';
  end if;

  update shopping_list_items sli
  set photo_deleted_at = coalesce(sli.photo_deleted_at, now())
  where sli.id = p_item_id;

  return true;
end;
$$;

revoke all on function public.mark_photo_purged(uuid) from public, anon;
grant execute on function public.mark_photo_purged(uuid) to authenticated;

-- ============================================================
-- The DELETE policy the purge needs
-- ============================================================

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent (local test harness) — skipping policy';
    return;
  end if;

  -- Same membership predicate as read and insert. Note what this does
  -- NOT permit: there is still no UPDATE policy, so a photograph cannot
  -- be *replaced* — only removed. Substitution stays impossible;
  -- retention is now bounded.
  drop policy if exists list_photos_member_delete on storage.objects;
  create policy list_photos_member_delete on storage.objects
    for delete using (
      bucket_id = 'list-photos'
      and name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      and public.is_active_member(split_part(name, '/', 1)::uuid)
    );
end;
$$;

commit;
