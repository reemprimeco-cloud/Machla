-- HomeList — Phase 7: the household receives and works a list.
--
-- Implements master plan Phase 7 and Amendment 1 §16A.2/16A.3/16A.5/16A.6:
-- the owner sees lists grouped by category, checks products off, marks
-- them unavailable, and sees progress.
--
-- This is the other half of the split described in
-- docs/architecture/10-security-model.md §4 and
-- 13-shopping-list-grouping-checklist.md §5. Phase 6 gave the list's
-- author the *requested* fields (quantity, note) while the list is a
-- draft. This migration gives Owner/Member the *purchase-execution*
-- fields (purchase_status, purchased_at, purchased_by_user_id) from
-- `sent` onwards. Neither side can reach the other's columns — not as a
-- rule to remember, but as an absent capability:
--
--   * set_purchase_status names only the three purchase columns, so
--     checking an item off cannot also change what was asked for;
--   * it refuses a Worker caller outright, so the person who wrote the
--     list cannot mark their own request fulfilled;
--   * set_list_item (Phase 6) refuses any list that is not a draft, so
--     the request freezes the moment it is sent.

begin;

-- ============================================================
-- Shared precondition: caller may work this household's lists
-- ============================================================

-- Owner and Member, not Worker. Household *management* is owner-only, but
-- working the checklist is not — a family member shops too
-- (04-roles-permission-matrix.md). Factored out so the three mutations
-- below cannot drift apart on who is allowed to call them.
create or replace function public.assert_can_work_list(p_list_id uuid)
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

  -- Indistinguishable from "does not exist", so probing ids reveals
  -- nothing about other households.
  if v_list.id is null or not is_active_member(v_list.household_id) then
    raise exception 'LIST_NOT_FOUND' using errcode = '42501';
  end if;

  if not is_active_member(v_list.household_id, array['owner', 'member']) then
    raise exception 'NOT_HOUSEHOLD_SIDE' using errcode = '42501';
  end if;

  -- A draft has not been sent yet; it is still the author's private
  -- working copy and nobody else has any business touching it.
  if v_list.status = 'draft' then
    raise exception 'LIST_NOT_SENT' using errcode = '55000';
  end if;

  if v_list.status = 'archived' then
    raise exception 'LIST_ARCHIVED' using errcode = '55000';
  end if;

  return v_list;
end;
$$;

-- ============================================================
-- Receiving
-- ============================================================

-- Idempotent, and deliberately only ever moves sent -> viewed. Re-opening
-- a completed list must not walk its status backwards.
create or replace function public.mark_list_viewed(p_list_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list shopping_lists := assert_can_work_list(p_list_id);
  v_now timestamptz := now();
begin
  if v_list.status <> 'sent' then
    return v_list.viewed_at;
  end if;

  update shopping_lists sl
  set status = 'viewed', viewed_at = v_now, updated_at = v_now
  where sl.id = p_list_id and sl.status = 'sent';

  return v_now;
end;
$$;

-- ============================================================
-- Working the checklist
-- ============================================================

-- The ONLY write path into purchase_status / purchased_at /
-- purchased_by_user_id. Note the columns it does not name: quantity,
-- note, product_id, category_id. Marking an item purchased structurally
-- cannot alter what was requested (§16A.3).
create or replace function public.set_purchase_status(
  p_item_id uuid,
  p_status text
)
returns public.shopping_list_items
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item shopping_list_items;
  v_now timestamptz := now();
begin
  if p_status is null or p_status not in ('pending', 'purchased', 'unavailable') then
    raise exception 'INVALID_STATUS' using errcode = '22023';
  end if;

  select * into v_item from shopping_list_items sli where sli.id = p_item_id;
  if v_item.id is null then
    raise exception 'ITEM_NOT_FOUND' using errcode = '42501';
  end if;

  -- Authorization is on the parent list, which is where household
  -- membership actually lives.
  perform assert_can_work_list(v_item.list_id);

  update shopping_list_items sli
  set purchase_status = p_status,
      -- Un-checking clears the attribution rather than leaving a stale
      -- "purchased by" on an item that is no longer purchased.
      purchased_at = case when p_status = 'pending' then null else v_now end,
      purchased_by_user_id = case when p_status = 'pending' then null else auth.uid() end,
      updated_at = v_now
  where sli.id = p_item_id
  returning * into v_item;

  update shopping_lists sl set updated_at = v_now where sl.id = v_item.list_id;

  return v_item;
end;
$$;

-- ============================================================
-- Completing
-- ============================================================

-- Reversible: a list marked done by mistake can be reopened, which drops
-- it back to `viewed` rather than to `sent` (it has certainly been seen).
-- Completion is deliberately NOT gated on every item being checked off —
-- a shop can legitimately finish with items unavailable, and refusing to
-- close the list would just teach people to fake the checkboxes.
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
    where sl.id = p_list_id
    returning * into v_list;
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

-- ============================================================
-- Reading: lists with sender identity and progress
-- ============================================================

-- SECURITY DEFINER for one specific reason: `users` is scoped by RLS to
-- the caller's own row, so a plain select cannot resolve who sent a list.
-- The Phase 7 acceptance criterion is "the owner can identify exactly
-- which worker sent each list", so the sender's display name has to come
-- from somewhere — and this is the narrow, membership-checked place.
--
-- It returns display_name only. Phone numbers stay out, exactly as they
-- do in get_household_members (10-security-model.md §3).
--
-- Progress is item counts, never quantity-weighted: ten units of one
-- product is one checklist item (§16A.6, 13-*.md §6).
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
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not is_active_member(p_household_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

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
    -- Drafts are excluded unconditionally: another person's unsent list
    -- is not the household's business, whoever is asking.
    and sl.status <> 'draft'
    and (p_list_id is null or sl.id = p_list_id)
  group by sl.id, u.display_name
  order by sl.sent_at desc nulls last, sl.created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- ============================================================
-- Privileges — anon executes nothing (10-security-model.md §5B)
-- ============================================================

revoke all on function public.mark_list_viewed(uuid) from public, anon;
revoke all on function public.set_purchase_status(uuid, text) from public, anon;
revoke all on function public.set_list_completed(uuid, boolean) from public, anon;
revoke all on function public.get_household_lists(uuid, uuid, int) from public, anon;
revoke all on function public.assert_can_work_list(uuid) from public, anon, authenticated;

grant execute on function public.mark_list_viewed(uuid) to authenticated;
grant execute on function public.set_purchase_status(uuid, text) to authenticated;
grant execute on function public.set_list_completed(uuid, boolean) to authenticated;
grant execute on function public.get_household_lists(uuid, uuid, int) to authenticated;

commit;
