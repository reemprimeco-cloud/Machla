-- ============================================================
-- Photographed items — "it isn't in the catalogue, so here's a picture"
-- ============================================================
--
-- A worker who cannot find something in the 295-product catalogue can
-- photograph it instead. The photo becomes an item on the same shopping
-- list, and reaches the household exactly like every other item.
--
-- WHY IT IS A LIST ITEM AND NOT A SEPARATE CHANNEL
--
-- The alternative — a parallel "photos" inbox — would need its own send
-- action, its own notification type, its own read state, and its own
-- checklist, and the household would have to shop from two screens. As
-- a list item it inherits all of that for free: send_list, the
-- purchased/unavailable checklist, progress counting, notifications and
-- history already work, because none of them care what an item *is*.
--
-- WHY THE CATALOGUE GETS A 16th CATEGORY
--
-- §16A groups a list by `shopping_list_items.category_id` and orders by
-- `categories.sort_order`. Rather than special-case a null category in
-- every consumer, photographed items belong to a real category row
-- (`key = 'photo'`) that sorts last. Two consequences, both wanted:
-- grouping and ordering code is untouched, and the category appears in
-- the worker's browse grid as its own tile — which is where the camera
-- is opened from. `is_capture` tells the UI to open a camera there
-- instead of a product list.
--
-- SECURITY — THIS IS THE PART THAT MATTERS
--
-- These photographs are household data, not catalogue decoration. That
-- makes the existing `product-images` bucket the wrong model: it is
-- public on purpose, because the catalogue is world-readable.
--
-- A photograph taken inside someone's home is the opposite. The
-- `list-photos` bucket is therefore PRIVATE, and access is decided by
-- the same membership rule as the list the photo belongs to, enforced
-- by policy on storage.objects rather than by the application. A worker
-- removed from a household loses the photographs with the lists, in the
-- same request, because both answer to is_active_member().
--
-- The object path carries the household id as its first segment
-- (`<household_id>/<list_id>/<uuid>.jpg`), which is what lets a storage
-- policy authorize without a join back to a row that may not exist yet
-- at upload time.

begin;

-- ============================================================
-- 1. A category to group photographed items under
-- ============================================================

alter table public.categories
  add column if not exists is_capture boolean not null default false;

comment on column public.categories.is_capture is
  'True for the pseudo-category holding photographed items. The worker '
  'browse grid opens a camera on this tile instead of a product list; '
  'it has, and should have, no products.';

insert into public.categories (
  key, icon, sort_order, is_capture,
  name_en, name_ar, name_hi, name_te, name_ur, name_fil, name_ne, name_id, name_si
)
values (
  'photo', '📷', 9000, true,
  'Photo',        -- en
  'صورة',         -- ar
  'फ़ोटो',         -- hi
  'ఫోటో',          -- te
  'تصویر',        -- ur
  'Larawan',      -- fil
  'फोटो',          -- ne
  'Foto',         -- id
  'ඡායාරූපය'      -- si
)
on conflict (key) do update
  set is_capture = excluded.is_capture,
      icon = excluded.icon,
      sort_order = excluded.sort_order;

-- ============================================================
-- 2. An item may be a product OR a photograph
-- ============================================================

alter table public.shopping_list_items
  add column if not exists photo_path text;

alter table public.shopping_list_items
  alter column product_id drop not null;

comment on column public.shopping_list_items.photo_path is
  'Object path in the private list-photos bucket, '
  '<household_id>/<list_id>/<uuid>.<ext>. Set only on photographed '
  'items, which carry no product_id.';

-- Exactly one of the two. Without this, a null/null row would render as
-- a blank line the household cannot act on, and a both-set row would
-- have two competing identities.
alter table public.shopping_list_items
  drop constraint if exists shopping_list_items_product_xor_photo;

alter table public.shopping_list_items
  add constraint shopping_list_items_product_xor_photo check (
    (product_id is not null and photo_path is null)
    or (product_id is null and photo_path is not null)
  );

-- ============================================================
-- 3. Adding a photographed item
-- ============================================================

create or replace function public.add_photo_item(
  p_list_id uuid,
  p_photo_path text,
  p_quantity numeric default 1,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_household_id uuid;
  v_category_id uuid;
  v_item_id uuid;
  v_count int;
begin
  -- Same gate as every other worker write: the caller's own open draft,
  -- or nothing. Raises LIST_NOT_FOUND / LIST_NOT_DRAFT / FORBIDDEN.
  perform assert_own_draft(p_list_id);

  if p_quantity is null or p_quantity <= 0 or p_quantity > 999 then
    raise exception 'INVALID_QUANTITY' using errcode = '22023';
  end if;

  select sl.household_id into v_household_id
  from shopping_lists sl where sl.id = p_list_id;

  -- The path must live under the household this list belongs to. A
  -- worker who is a member of two households must not be able to attach
  -- one household's photograph to the other's list, and the storage
  -- policy alone cannot see which list the object was destined for.
  if p_photo_path is null
     or p_photo_path <> v_household_id::text || '/' || p_list_id::text ||
                        '/' || split_part(p_photo_path, '/', 3)
     or split_part(p_photo_path, '/', 3) = ''
     or p_photo_path ~ '\.\.' then
    raise exception 'INVALID_PHOTO_PATH' using errcode = '22023';
  end if;

  select c.id into v_category_id from categories c where c.key = 'photo';
  if v_category_id is null then
    raise exception 'PRODUCT_NOT_FOUND' using errcode = '22023';
  end if;

  -- A bound on photographs per list. Not a storage concern so much as a
  -- usability one: a checklist of ninety photographs is not shoppable,
  -- and an accidental burst should fail loudly rather than quietly fill
  -- the household's screen.
  select count(*) into v_count
  from shopping_list_items sli
  where sli.list_id = p_list_id and sli.photo_path is not null;

  if v_count >= 20 then
    raise exception 'TOO_MANY_PHOTOS' using errcode = '22023';
  end if;

  -- sort_order puts photographs in capture order within their group;
  -- unit is 'piece' because a photographed thing has no catalogue unit.
  insert into shopping_list_items (
    list_id, product_id, category_id, photo_path, quantity, unit, note, sort_order
  )
  values (
    p_list_id, null, v_category_id, p_photo_path,
    p_quantity, 'piece', nullif(btrim(p_note), ''), v_count
  )
  returning id into v_item_id;

  update shopping_lists sl set updated_at = now() where sl.id = p_list_id;

  return v_item_id;
end;
$$;

-- remove_list_item() is keyed on product_id, which a photographed item
-- does not have. This is the id-keyed twin, and it is deliberately
-- restricted to the same own-draft gate rather than being a general
-- "delete any item".
create or replace function public.remove_photo_item(p_item_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list_id uuid;
  v_photo_path text;
begin
  select sli.list_id, sli.photo_path into v_list_id, v_photo_path
  from shopping_list_items sli
  where sli.id = p_item_id and sli.photo_path is not null;

  -- Same deliberate ambiguity as LIST_NOT_FOUND: "not yours" and "does
  -- not exist" must be indistinguishable, or ids become probeable.
  if v_list_id is null then
    raise exception 'ITEM_NOT_FOUND' using errcode = '22023';
  end if;

  perform assert_own_draft(v_list_id);

  delete from shopping_list_items sli where sli.id = p_item_id;
  update shopping_lists sl set updated_at = now() where sl.id = v_list_id;

  -- The object itself is left in the bucket. Deleting it here would need
  -- this function to reach into storage as its definer, and an orphaned
  -- private object that no row references is readable by nobody through
  -- the app. Cleanup belongs in a maintenance sweep, not in a user
  -- request that must stay fast on a bad connection.
  return true;
end;
$$;

-- ============================================================
-- 4. Grants — anon gets nothing, as everywhere else
-- ============================================================

revoke all on function public.add_photo_item(uuid, text, numeric, text) from public, anon;
revoke all on function public.remove_photo_item(uuid) from public, anon;

grant execute on function public.add_photo_item(uuid, text, numeric, text) to authenticated;
grant execute on function public.remove_photo_item(uuid) to authenticated;

-- ============================================================
-- 5. The private bucket
-- ============================================================

-- Guarded exactly as the product-images migration is: supabase/tests/
-- applies these files to a plain PostgreSQL instance with no `storage`
-- schema. The policies below are therefore verified against the live
-- project rather than by the SQL suite, and that difference is recorded
-- in docs/architecture/19-photo-items.md §4.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent (local test harness) — skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'list-photos',
    'list-photos',
    false,                                    -- PRIVATE. This is household data.
    3145728,                                  -- 3 MB; the client downscales before upload
    array['image/webp', 'image/jpeg', 'image/png']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Read: any active member of the household named by the first path
  -- segment. This is the same predicate that decides who may read the
  -- list, so a removed worker loses both at the same instant.
  --
  -- The name pattern is checked BEFORE the cast: an object whose first
  -- segment is not a uuid would otherwise raise on ::uuid and take the
  -- whole query with it.
  drop policy if exists list_photos_member_read on storage.objects;
  create policy list_photos_member_read on storage.objects
    for select using (
      bucket_id = 'list-photos'
      and name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      and public.is_active_member(split_part(name, '/', 1)::uuid)
    );

  -- Write: same membership test. Upload happens before the item row
  -- exists, so there is nothing else to authorize against — which is
  -- precisely why the household id is in the path.
  drop policy if exists list_photos_member_insert on storage.objects;
  create policy list_photos_member_insert on storage.objects
    for insert with check (
      bucket_id = 'list-photos'
      and name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      and public.is_active_member(split_part(name, '/', 1)::uuid)
    );

  -- No UPDATE and no DELETE policy for clients, deliberately. A
  -- photograph attached to a sent list is evidence of what was asked
  -- for; letting the sender swap the file afterwards would make the
  -- household's screen unreliable. Same reasoning as "a sent list is
  -- frozen" (18-backend-contract.md §5).
  drop policy if exists list_photos_member_update on storage.objects;
  drop policy if exists list_photos_member_delete on storage.objects;
end;
$$;

commit;
