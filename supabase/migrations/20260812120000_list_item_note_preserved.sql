-- ============================================================
-- A note survives a quantity-only change
-- ============================================================
--
-- set_list_item (20260809170000_phase6_worker_lists.sql) always wrote
-- `note = nullif(btrim(p_note), '')` on every UPDATE, including the
-- quantity stepper's own calls — and the stepper never passes a note at
-- all, so tapping "+" or "-" on an item that already had one silently
-- wiped it back to null. Harmless while nothing in the UI ever set a
-- note past the first add; it stops being harmless now that a person can
-- add or edit one from the review screen after the quantity has already
-- been changed a few times.
--
-- `p_update_note` distinguishes the two kinds of caller: the quantity
-- stepper (never touches the note) from an explicit note edit (always
-- touches it, including clearing it back to null). Appended as a new
-- parameter with a default, rather than reordering the existing ones, so
-- no call site written before this migration breaks; every one of them
-- keeps behaving exactly as it already did.
--
-- Postgres identifies a function by its parameter TYPES, not its
-- defaults, so adding a parameter is a new signature, not a replacement
-- of the old one — `create or replace` alone would leave both overloads
-- installed side by side. The old four-argument version is dropped
-- explicitly first so there is exactly one set_list_item again.

begin;

drop function if exists public.set_list_item(uuid, uuid, numeric, text);

create or replace function public.set_list_item(
  p_list_id uuid,
  p_product_id uuid,
  p_quantity numeric default 1,
  p_note text default null,
  p_update_note boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product products;
  v_item_id uuid;
  v_is_new boolean := false;
begin
  perform assert_own_draft(p_list_id);

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  -- Guard against an absurd quantity reaching the owner's screen; the
  -- stepper cannot produce one, but a direct RPC call could.
  if p_quantity > 999 then
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
    v_is_new := true;

    -- category_id, unit and sort_order are SNAPSHOTS taken here, not live
    -- joins — see the original migration for why. A first add may as
    -- well carry a note directly if the caller has one.
    insert into shopping_list_items (
      list_id, product_id, category_id, quantity, unit, note, sort_order
    )
    values (
      p_list_id, p_product_id, v_product.category_id,
      p_quantity, v_product.unit, nullif(btrim(p_note), ''), v_product.sort_order
    )
    returning id into v_item_id;
  else
    -- Note the columns still absent from this SET list: purchase_status,
    -- purchased_at, purchased_by_user_id. Nothing a worker calls may
    -- write them.
    update shopping_list_items sli
    set quantity = p_quantity,
        note = case when p_update_note then nullif(btrim(p_note), '') else sli.note end,
        updated_at = now()
    where sli.id = v_item_id;
  end if;

  update shopping_lists sl set updated_at = now() where sl.id = p_list_id;

  -- "Frequently used" counts how often a product is *chosen*, so only a
  -- first add counts. Otherwise nudging the quantity stepper four times
  -- would rank a product above one genuinely bought every week.
  if v_is_new then
    insert into product_usage_stats (user_id, product_id, selection_count, last_selected_at)
    values (auth.uid(), p_product_id, 1, now())
    on conflict (user_id, product_id) do update
      set selection_count = product_usage_stats.selection_count + 1,
          last_selected_at = now();
  end if;

  return v_item_id;
end;
$$;

comment on function public.set_list_item is
  'Upserts a product onto a draft list. p_update_note must be true for '
  'the note to actually change on an existing row — false (the default) '
  'preserves whatever note is already there, which is what a '
  'quantity-only stepper call needs.';

revoke all on function public.set_list_item(uuid, uuid, numeric, text, boolean) from public, anon;
grant execute on function public.set_list_item(uuid, uuid, numeric, text, boolean) to authenticated;

commit;
