-- Lets the admin upload real product photos (background-removed by Claude,
-- uploaded through a small admin-only tool) into the public product-images
-- bucket. Previously this bucket only had a public SELECT policy — every
-- existing file was seeded directly, nothing could write to it from the
-- app. Scoped to is_admin_operator() same as every other admin write in
-- this schema (20260923120000_admin_country_and_feedback.sql).

begin;

create policy product_images_admin_insert
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and is_admin_operator());

create policy product_images_admin_update
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and is_admin_operator())
with check (bucket_id = 'product-images' and is_admin_operator());

commit;
