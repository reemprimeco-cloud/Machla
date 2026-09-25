-- categories only grants SELECT via RLS (categories_select_all), same
-- as products — the owner wants a proper upload UI for a category's
-- own tile image (categories.image_url, 20260925110000) instead of a
-- one-off migration each time, so this gets the same SECURITY DEFINER
-- RPC treatment as admin_update_product_image.

begin;

create or replace function public.admin_update_category_image(p_category_id uuid, p_image_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update categories set image_url = p_image_url where id = p_category_id;
end;
$$;

revoke all on function public.admin_update_category_image(uuid, text) from public, anon;
grant execute on function public.admin_update_category_image(uuid, text) to authenticated;

commit;
