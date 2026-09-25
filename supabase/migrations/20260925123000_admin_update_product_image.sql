-- products only ever grants SELECT via RLS (docs/architecture/10-
-- security-model.md §1) — every write goes through a SECURITY DEFINER
-- RPC. /admin/photos' per-product upload (uploadProductImageAction,
-- lib/admin/actions.ts) needs to set image_url after a successful
-- Storage upload, so it gets the same treatment as every other write in
-- this schema rather than a bespoke RLS policy on products.

begin;

create or replace function public.admin_update_product_image(p_product_id uuid, p_image_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin_operator() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  update products set image_url = p_image_url, updated_at = now() where id = p_product_id;
end;
$$;

revoke all on function public.admin_update_product_image(uuid, text) from public, anon;
grant execute on function public.admin_update_product_image(uuid, text) to authenticated;

commit;
