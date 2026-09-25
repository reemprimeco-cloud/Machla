-- The owner asked for a way to browse every category/product and
-- delete or add products, alongside the existing photo-upload tool on
-- /admin/photos. products only ever grants SELECT via RLS (docs/
-- architecture/10-security-model.md §1), so both writes get the same
-- SECURITY DEFINER RPC treatment as every other write in this schema
-- (see admin_update_product_image, 20260925123000).

begin;

-- Soft delete / restore — same is_active flag the catalog query already
-- filters on (20260925154000_dedupe_rice_and_chicken_brand_variants.sql
-- used this by hand; this is the RPC so the admin UI can do it too).
create or replace function public.admin_set_product_active(p_product_id uuid, p_is_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update products set is_active = p_is_active, updated_at = now() where id = p_product_id;
end;
$$;

revoke all on function public.admin_set_product_active(uuid, boolean) from public, anon;
grant execute on function public.admin_set_product_active(uuid, boolean) to authenticated;

-- A quick ad-hoc add from the admin UI, not the bulk CSV/PDF importer
-- path — only name_en/name_ar are hers to type, the other nine
-- language columns fall back to the English string (same treatment the
-- Tamween import already gives a pure proper noun like "PediaSure") so
-- the row is never left with a null NOT NULL name column. natural_key
-- gets a random unique value since there's no stable source list to
-- key it off of here.
create or replace function public.admin_create_product(
  p_category_id uuid,
  p_name_ar text,
  p_name_en text,
  p_brand text,
  p_icon text,
  p_unit text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_sort_order int;
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_sort_order
  from products where category_id = p_category_id;

  insert into products (
    category_id, brand, name_en, name_ar, name_hi, name_te, name_ur, name_fil,
    name_ne, name_id, name_si, name_am, name_fr, name_fon,
    unit, icon, sort_order, natural_key, is_active
  ) values (
    p_category_id, nullif(p_brand, ''), p_name_en, p_name_ar, p_name_en, p_name_en, p_name_en, p_name_en,
    p_name_en, p_name_en, p_name_en, p_name_en, p_name_en, p_name_en,
    p_unit, nullif(p_icon, ''), v_sort_order,
    'admin_' || replace(gen_random_uuid()::text, '-', ''), true
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.admin_create_product(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_product(uuid, text, text, text, text, text) to authenticated;

commit;
