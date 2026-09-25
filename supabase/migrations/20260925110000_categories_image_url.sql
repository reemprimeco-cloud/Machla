-- Lets a category tile show a real image (a brand's own logo, e.g. KFM)
-- instead of only an emoji. Categories never had this before — every
-- other category still uses its emoji icon; this is additive and
-- optional.

begin;

alter table public.categories
  add column if not exists image_url text;

comment on column public.categories.image_url is
  'Optional real image for the category tile (CategoryGrid.tsx), e.g. a '
  'brand logo for a brand-specific category like "kfm". Null falls back '
  'to the emoji icon column, same fallback shape as products.image_url.';

update categories set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/kfm_logo.webp' where key = 'kfm';
update categories set image_url = 'https://uwouqetlzwvnlrirrhbh.supabase.co/storage/v1/object/public/product-images/tamween_logo.webp' where key = 'tamween';

commit;
