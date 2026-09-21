-- Owner request (2026-09-21): a worker who realizes she needs more items
-- after sending had to start a whole second list (get_or_create_draft_list
-- only ever finds a 'draft'), and an owner/member who thinks of something
-- extra had no way to add it to the list a worker is already shopping
-- from — the only household-side write path is set_purchase_status,
-- which names purchase_status/purchased_at/purchased_by_user_id and
-- nothing else (20260809190000_phase7_household_lists.sql).
--
-- This is a deliberate, narrow crack in the guarantee
-- 20260809170000_phase6_worker_lists.sql/10-security-model.md §5 describe
-- as "once sent, no requested-field write path remains for anyone": that
-- guarantee existed to stop a list's creator from *retroactively changing*
-- what they originally asked for, so the two sides can't end up
-- disagreeing about a request already acted on. Appending a brand-new item
-- doesn't touch that — nothing already on the list is edited or removed
-- here, ever. added_by_user_id marks exactly what's new, so the UI can
-- show "added after sending" without pretending it was part of the
-- original ask.
--
-- Allowed callers: the list's own creator (continuing to add after
-- sending), or an active owner/member of the household (the "don't let
-- them forget" case) — never a different worker than the one who built
-- it. Allowed statuses: 'sent'/'viewed' only, mirroring
-- assert_can_work_list's own draft/archived refusals.

begin;

alter table public.shopping_list_items
  add column if not exists added_by_user_id uuid references public.users (id);

comment on column public.shopping_list_items.added_by_user_id is
  'Set only when this item was appended via add_item_to_sent_list, after '
  'the list had already been sent — null means it was part of the '
  'original draft. Who added it (the creator, continuing, or a '
  'different owner/member) rather than what: the UI shows this as an '
  '"added after sending" marker, not attributed to a name.';

create or replace function public.assert_can_add_item(p_list_id uuid)
returns public.shopping_lists
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_list shopping_lists;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_list from shopping_lists sl where sl.id = p_list_id;

  if v_list.id is null or not is_active_member(v_list.household_id) then
    raise exception 'LIST_NOT_FOUND' using errcode = '42501';
  end if;

  if v_list.created_by_user_id <> v_user_id
     and not is_active_member(v_list.household_id, array['owner', 'member']) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_list.status = 'draft' then
    raise exception 'LIST_NOT_SENT' using errcode = '55000';
  end if;

  if v_list.status = 'archived' then
    raise exception 'LIST_ARCHIVED' using errcode = '55000';
  end if;

  return v_list;
end;
$$;

-- Appends a product to a list that has already been sent. Never updates
-- an existing row's note (that would edit the original ask); if the
-- product is already on the list, the new quantity is added to it —
-- "need 2 more of these", not a silent no-op or a duplicate row.
create or replace function public.add_item_to_sent_list(
  p_list_id uuid,
  p_product_id uuid,
  p_quantity numeric default 1,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_product products;
  v_item_id uuid;
begin
  perform assert_can_add_item(p_list_id);

  if p_quantity is null or p_quantity <= 0 or p_quantity > 999 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  select * into v_product from products p where p.id = p_product_id and p.is_active;
  if v_product.id is null then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = '22023';
  end if;

  select sli.id into v_item_id
  from shopping_list_items sli
  where sli.list_id = p_list_id and sli.product_id = p_product_id;

  if v_item_id is null then
    insert into shopping_list_items (
      list_id, product_id, category_id, quantity, unit, note, sort_order, added_by_user_id
    )
    values (
      p_list_id, p_product_id, v_product.category_id,
      p_quantity, v_product.unit, nullif(btrim(p_note), ''), v_product.sort_order, v_user_id
    )
    returning id into v_item_id;
  else
    update shopping_list_items sli
    set quantity = sli.quantity + p_quantity,
        updated_at = now()
    where sli.id = v_item_id;
  end if;

  update shopping_lists sl set updated_at = now() where sl.id = p_list_id;

  insert into product_usage_stats (user_id, product_id, selection_count, last_selected_at)
  values (v_user_id, p_product_id, 1, now())
  on conflict (user_id, product_id) do update
    set selection_count = product_usage_stats.selection_count + 1,
        last_selected_at = now();

  return v_item_id;
end;
$$;

revoke all on function public.assert_can_add_item(uuid) from public, anon, authenticated;
revoke all on function public.add_item_to_sent_list(uuid, uuid, numeric, text) from public, anon;
grant execute on function public.add_item_to_sent_list(uuid, uuid, numeric, text) to authenticated;

commit;
