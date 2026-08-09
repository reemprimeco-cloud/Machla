-- HomeList — Phase 6: the worker's shopping-list lifecycle.
--
-- Implements master plan Phase 6 and Amendment 1 Section 16A.1: a worker
-- builds a draft list, every selected product keeps its category, and the
-- list is sent without being flattened or reordered.
--
-- Same boundary as Phase 4: the Phase 1 migration granted SELECT policies
-- on shopping_lists / shopping_list_items / product_usage_stats and
-- nothing else, so the SECURITY DEFINER functions below are the only
-- write paths. A client holding the anon key cannot reach the tables
-- directly (docs/architecture/10-security-model.md §1).
--
-- What these functions deliberately never touch: purchase_status,
-- purchased_at, purchased_by_user_id. Those belong to the household side
-- of the checklist (Phase 7, Section 16A.2/16A.5) and are not writable by
-- any code path a worker can reach — approved Phase 0 decision 6.

begin;

-- ============================================================
-- Draft lifecycle
-- ============================================================

-- One open draft per (household, worker). Returning the existing draft
-- rather than creating a second one is what makes the worker's list
-- survive closing the app mid-shop — the common case on a low-end phone.
create or replace function public.get_or_create_draft_list(
  p_household_id uuid,
  p_language text default 'en'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_list_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- Any active member may build a list. Household *management* is
  -- owner-only, but list-building is not — workers and members have the
  -- same list permissions (04-roles-permission-matrix.md).
  if not is_active_member(p_household_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select sl.id into v_list_id
  from shopping_lists sl
  where sl.household_id = p_household_id
    and sl.created_by_user_id = v_user_id
    and sl.status = 'draft'
  order by sl.created_at desc
  limit 1;

  if v_list_id is not null then
    return v_list_id;
  end if;

  insert into shopping_lists (household_id, created_by_user_id, status, language)
  values (p_household_id, v_user_id, 'draft', coalesce(nullif(btrim(p_language), ''), 'en'))
  returning id into v_list_id;

  return v_list_id;
end;
$$;

comment on function public.get_or_create_draft_list is
  'Returns the caller''s open draft for a household, creating one if there '
  'is none. Idempotent by design: a worker who reopens the app resumes the '
  'same list rather than starting a second one.';

-- Shared precondition for every item mutation: the list exists, the
-- caller created it, it is still a draft, and the caller is still an
-- active member. Split out so the three mutations cannot drift apart.
create or replace function public.assert_own_draft(p_list_id uuid)
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

  -- Same refusal whether the list is missing or belongs to someone else,
  -- so probing ids cannot distinguish the two.
  if v_list.id is null or v_list.created_by_user_id <> v_user_id then
    raise exception 'LIST_NOT_FOUND' using errcode = '42501';
  end if;

  if not is_active_member(v_list.household_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  -- A sent list is a record of what was asked for. Letting the worker
  -- keep editing it after the owner has seen it would make the two sides
  -- disagree about what was requested.
  if v_list.status <> 'draft' then
    raise exception 'LIST_NOT_DRAFT' using errcode = '55000';
  end if;

  return v_list;
end;
$$;

-- ============================================================
-- Items
-- ============================================================

-- Add a product, or change the quantity/note of one already on the list.
-- Upsert rather than separate add/update calls: the UI's quantity stepper
-- does not care whether the row exists yet, and this way a double-tap
-- cannot produce two rows for the same product.
create or replace function public.set_list_item(
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
    -- joins. A product re-categorized by a later catalogue import must
    -- not silently move between groups on a list that has already been
    -- sent (Section 16A.4, 13-shopping-list-grouping-checklist.md §4).
    insert into shopping_list_items (
      list_id, product_id, category_id, quantity, unit, note, sort_order
    )
    values (
      p_list_id, p_product_id, v_product.category_id,
      p_quantity, v_product.unit, nullif(btrim(p_note), ''), v_product.sort_order
    )
    returning id into v_item_id;
  else
    -- Note the columns absent from this SET list: purchase_status,
    -- purchased_at, purchased_by_user_id. Nothing a worker calls may
    -- write them.
    update shopping_list_items sli
    set quantity = p_quantity,
        note = nullif(btrim(p_note), ''),
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

create or replace function public.remove_list_item(
  p_list_id uuid,
  p_product_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int;
begin
  perform assert_own_draft(p_list_id);

  delete from shopping_list_items sli
  where sli.list_id = p_list_id and sli.product_id = p_product_id;

  get diagnostics v_deleted = row_count;

  if v_deleted > 0 then
    update shopping_lists sl set updated_at = now() where sl.id = p_list_id;
  end if;

  return v_deleted > 0;
end;
$$;

-- ============================================================
-- Sending
-- ============================================================

create or replace function public.send_list(p_list_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sent_at timestamptz := now();
  v_items int;
begin
  perform assert_own_draft(p_list_id);

  select count(*) into v_items
  from shopping_list_items sli where sli.list_id = p_list_id;

  if v_items = 0 then
    raise exception 'LIST_EMPTY' using errcode = '22023';
  end if;

  -- Guarded on status again rather than trusting assert_own_draft alone:
  -- under concurrency two sends could both pass the check above, and this
  -- makes the second one a no-op instead of a second notification.
  update shopping_lists sl
  set status = 'sent', sent_at = v_sent_at, updated_at = v_sent_at
  where sl.id = p_list_id and sl.status = 'draft';

  if not found then
    raise exception 'LIST_NOT_DRAFT' using errcode = '55000';
  end if;

  return v_sent_at;
end;
$$;

-- ============================================================
-- Frequently used products
-- ============================================================

-- SECURITY INVOKER: product_usage_stats already has an RLS policy
-- scoping it to `user_id = auth.uid()`, so running as the caller gives
-- exactly the right rows with no privileged surface added.
create or replace function public.get_frequent_products(p_limit int default 12)
returns setof public.products
language sql
stable
security invoker
set search_path = public
as $$
  select p.*
  from product_usage_stats pus
  join products p on p.id = pus.product_id
  where p.is_active
  order by pus.selection_count desc, pus.last_selected_at desc nulls last, p.sort_order
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;

-- ============================================================
-- Privileges — anon executes nothing (10-security-model.md §5B)
-- ============================================================

revoke all on function public.get_or_create_draft_list(uuid, text) from public, anon;
revoke all on function public.set_list_item(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.remove_list_item(uuid, uuid) from public, anon;
revoke all on function public.send_list(uuid) from public, anon;
revoke all on function public.get_frequent_products(int) from public, anon;

-- assert_own_draft is an internal helper. It performs an authorization
-- check but returns a whole shopping_lists row, so it is not exposed:
-- there is no reason for a client to call it, and every function that
-- does call it is itself authorized.
revoke all on function public.assert_own_draft(uuid) from public, anon, authenticated;

grant execute on function public.get_or_create_draft_list(uuid, text) to authenticated;
grant execute on function public.set_list_item(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.remove_list_item(uuid, uuid) to authenticated;
grant execute on function public.send_list(uuid) to authenticated;
grant execute on function public.get_frequent_products(int) to authenticated;

commit;
