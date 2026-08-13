-- The catalogue carried nine name columns (name_en … name_si) while the
-- UI carried twelve locales: Amharic, French and Fon were added for app
-- chrome only, and `toCatalogLocale` (lib/i18n/config.ts) mapped all
-- three down to English for product and category names.
--
-- These three columns close that gap — but NULLABLE, unlike the original
-- nine, and that is the whole design:
--
--   * a row with a name in one of these languages uses it;
--   * a row without falls back to English, exactly as before.
--
-- So the catalogue can be translated incrementally, category by
-- category, instead of needing all 168 product types translated into
-- three more languages before any of it ships. `build-catalog.mjs`
-- enforces the original nine as required and treats these as optional,
-- for the same reason.

begin;

alter table public.categories
  add column if not exists name_am text,
  add column if not exists name_fr text,
  add column if not exists name_fon text;

alter table public.products
  add column if not exists name_am text,
  add column if not exists name_fr text,
  add column if not exists name_fon text;

comment on column public.products.name_am is
  'Optional, unlike name_en..name_si. Null means "not translated yet" and '
  'the UI falls back to name_en (lib/catalog/localized.ts).';
comment on column public.products.name_fr is
  'Optional — see name_am.';
comment on column public.products.name_fon is
  'Optional — see name_am.';

-- Search has to know about them too, or a product translated into French
-- would be invisible to someone searching in French — the whole point of
-- translating it. concat_ws skips nulls, so untranslated rows are
-- unaffected (20260809160000_phase5_catalog.sql).
create or replace function public.products_refresh_search_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text := lower(concat_ws(' ',
    new.name_en, new.name_ar, new.name_hi, new.name_te, new.name_ur,
    new.name_fil, new.name_ne, new.name_id, new.name_si,
    new.name_am, new.name_fr, new.name_fon,
    new.brand,
    new.size,
    array_to_string(coalesce(new.search_keywords, '{}'), ' ')
  ));
  return new;
end;
$$;

-- Re-run the trigger over every existing row so the column reflects the
-- new definition rather than only applying to future writes.
update public.products set updated_at = updated_at;

commit;
