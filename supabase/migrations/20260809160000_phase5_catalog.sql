-- HomeList — Phase 5: product catalogue support.
--
-- Adds what the curated import and the worker's product search need on
-- top of the Phase 1 `categories` / `products` tables:
--   * a natural key, so re-running the import updates rows instead of
--     duplicating them;
--   * a maintained search_text column + trigram index;
--   * search_products(), the one read path the worker UI will use.
--
-- Still no price column, and still no client write path into the
-- catalogue: `categories` and `products` remain readable by everyone and
-- writable only by the service role running the offline importer
-- (docs/architecture/11-product-catalog-architecture.md).

begin;

-- pg_trgm goes in `extensions`, not `public`. An extension installed into
-- `public` puts every function it ships (similarity(), show_trgm(), ...)
-- into the schema PostgREST exposes, so they become callable over
-- /rest/v1/rpc/ — extension functions carry EXECUTE for PUBLIC, so that
-- includes anon. Nothing here is dangerous on its own, but the project's
-- posture is that anon executes nothing (docs/architecture/10-security-
-- model.md §5B), and Supabase's own linter flags the public placement.
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated;

do $$
declare
  v_schema text;
begin
  select n.nspname into v_schema
  from pg_extension e
  join pg_namespace n on n.oid = e.extnamespace
  where e.extname = 'pg_trgm';

  if v_schema is null then
    execute 'create extension pg_trgm with schema extensions';
  elsif v_schema <> 'extensions' then
    -- Relocating carries the operator class with it, so any index already
    -- built on gin_trgm_ops stays valid (it references the opclass by oid).
    execute 'alter extension pg_trgm set schema extensions';
  end if;
end;
$$;

-- ============================================================
-- Natural key (idempotent import)
-- ============================================================

-- "<type>|<brand>|<size>", lowercased, built by
-- catalog-import/scripts/build-catalog.mjs. The importer upserts on this
-- rather than on id, because ids are generated here and the source files
-- have no stable identifier of their own.
alter table public.products
  add column if not exists natural_key text;

-- Deliberately NOT a partial index (`where natural_key is not null`).
-- Postgres already treats NULLs as distinct in a unique index, so the
-- predicate would add nothing — but it would make the index impossible for
-- PostgREST to use as an ON CONFLICT arbiter: `on_conflict=natural_key`
-- emits `on conflict (natural_key)` with no index predicate, and Postgres
-- refuses to infer a partial index from that. The importer's upsert would
-- fail outright.
-- Only rebuilt if an earlier run left a partial one behind, so re-running
-- this migration does not needlessly drop and rebuild a valid index.
do $$
begin
  if exists (
    select 1 from pg_index i
    where i.indexrelid = to_regclass('public.products_natural_key_idx')
      and i.indpred is not null
  ) then
    execute 'drop index public.products_natural_key_idx';
  end if;
end;
$$;

create unique index if not exists products_natural_key_idx
  on public.products (natural_key);

comment on column public.products.natural_key is
  'Stable identity for a curated catalogue row (type|brand|size). Used by '
  'the offline importer to upsert; re-running the import must not create '
  'duplicates. Null for any row created outside that pipeline.';

-- ============================================================
-- Search
-- ============================================================

alter table public.products
  add column if not exists search_text text;

comment on column public.products.search_text is
  'All nine localized names + brand + search_keywords, lowercased into '
  'one haystack. Maintained by trigger, so it cannot drift from the row '
  'regardless of who writes it.';

-- A trigger rather than a generated column: a generated column requires
-- every expression to be IMMUTABLE, which constrains what can go in here
-- later (unaccent, for instance, is only STABLE). The trigger has no such
-- restriction and gives the same guarantee — the column is always in sync.
create or replace function public.products_refresh_search_text()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text := lower(concat_ws(' ',
    new.name_en, new.name_ar, new.name_hi, new.name_te, new.name_ur,
    new.name_fil, new.name_ne, new.name_id, new.name_si,
    new.brand,
    new.size,
    array_to_string(coalesce(new.search_keywords, '{}'), ' ')
  ));
  return new;
end;
$$;

drop trigger if exists products_search_text_trigger on public.products;
create trigger products_search_text_trigger
  before insert or update on public.products
  for each row execute function public.products_refresh_search_text();

-- Backfill anything that predates the trigger.
update public.products set search_text = search_text where search_text is null;

create index if not exists products_search_text_trgm_idx
  on public.products using gin (search_text extensions.gin_trgm_ops);

-- ============================================================
-- search_products
-- ============================================================

-- SECURITY INVOKER, unlike the household RPCs: the catalogue is public
-- reference data whose RLS policy is `using (true)`, so there is nothing
-- for a definer-rights function to unlock. Running as the caller keeps
-- RLS in force and avoids adding another privileged surface.
--
-- Searches every language at once rather than just the caller's, so a
-- worker who types a transliteration ("gatas", "doodh") or a brand
-- ("Almarai") finds the row whatever their UI language is — master plan
-- Section 20. Ranking prefers a prefix match, then a substring match,
-- then trigram similarity, so exact-ish matches surface first.
create or replace function public.search_products(
  p_query text,
  p_limit int default 50
)
returns setof public.products
language sql
stable
security invoker
-- `extensions` is on the path because the `%` operator and similarity()
-- live there now, not in public.
set search_path = public, extensions
as $$
  with q as (select lower(btrim(coalesce(p_query, ''))) as term)
  select p.*
  from public.products p, q
  where p.is_active
    and q.term <> ''
    and (p.search_text like q.term || '%'
         or p.search_text like '%' || q.term || '%'
         or p.search_text % q.term)
  order by
    case
      when p.search_text like q.term || '%' then 0
      when p.search_text like '% ' || q.term || '%' then 1
      when p.search_text like '%' || q.term || '%' then 2
      else 3
    end,
    similarity(p.search_text, q.term) desc,
    p.sort_order,
    p.name_en
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

-- Same posture as every other function: anon executes nothing.
revoke all on function public.products_refresh_search_text() from public, anon, authenticated;
revoke all on function public.search_products(text, int) from public, anon;
grant execute on function public.search_products(text, int) to authenticated;

commit;
