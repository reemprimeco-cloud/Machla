-- HomeList — product icons and a home for licensed product photography.
--
-- Two separate things, deliberately kept separate:
--
--   * `products.icon` — a per-type glyph, shipped with the catalogue.
--     Always present, costs nothing, works offline.
--   * `products.image_url` — a real photograph, when one has been
--     licensed. Nullable, and expected to stay null for most rows for a
--     long time.
--
-- The UI falls back icon → category icon, so a row with no photograph is
-- a complete row, not a broken one. That matters because sourcing 168
-- licensed photographs is a content project measured in weeks, and the
-- app has to be usable throughout.

begin;

-- ============================================================
-- Icons
-- ============================================================

alter table public.products
  add column if not exists icon text;

comment on column public.products.icon is
  'Per-product-type glyph, set by the offline importer from '
  'catalog-import/data/product-types.json. Distinct within a category, so '
  'a shopper navigating by picture can tell two products apart without '
  'reading. Falls back to the category icon when null.';

-- ============================================================
-- Storage for licensed photography
-- ============================================================

-- A dedicated bucket rather than the catalogue tables: images are blobs
-- with their own lifecycle, and keeping them out of Postgres means
-- replacing a photograph never touches a row the app is reading.
--
-- public = true makes objects readable without a signed URL, which is
-- what the product grid needs — the images are decoration on a catalogue
-- that is itself world-readable, and signing every URL on every grid
-- render would cost a round trip per tile for no privacy gain.
--
-- IMPORTANT, for whoever adds images: a public bucket means anyone with
-- the URL can fetch the file. Stock licences generally permit displaying
-- an image inside a product but forbid redistributing it as a standalone
-- downloadable asset, and a public bucket sits close to that line. Check
-- the licence tier before bulk-uploading, and keep originals out of it —
-- upload web-sized derivatives only (catalog-import/scripts/upload-images.mjs
-- resizes on the way in).
-- Guarded on the schema existing: supabase/tests/ applies these migrations
-- to a plain PostgreSQL instance, which has no `storage` schema. The
-- guard keeps the SQL suite runnable without stubbing all of Supabase
-- Storage, which would test nothing of ours.
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema absent (local test harness) — skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'product-images',
    'product-images',
    true,
    2097152,                                  -- 2 MB: these render at ~200px
    array['image/webp', 'image/jpeg', 'image/png']
  )
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Read for everyone; writes only for the service role running the
  -- offline uploader. Same posture as the catalogue tables themselves: no
  -- client write path exists at all (10-security-model.md §1).
  drop policy if exists product_images_public_read on storage.objects;
  create policy product_images_public_read on storage.objects
    for select using (bucket_id = 'product-images');
end;
$$;

commit;
