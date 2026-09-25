-- Simplified per-person favorites (2026-09-25): one implicit list per
-- user, no naming, no multiple lists — the owner picked this over the
-- fuller "named favorite lists + picker" version to ship something
-- useful now. A worker gets the exact same mechanism as an owner/member
-- ("حتى العاملة تقدر..."): tap the heart on any product, it's saved to
-- *her own* favorites, independent of any household's shared list.
--
-- One row per (user, product) rather than a "list" table — there is
-- nothing a list table would hold beyond what this join already does.
-- No household_id: favorites are personal and follow the person, not a
-- household (a worker helping two households keeps one favorites set).

begin;

create table public.favorite_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index favorite_items_user_id_idx on public.favorite_items(user_id);

alter table public.favorite_items enable row level security;

-- Reads go straight through RLS (own rows only) — writes go through the
-- RPC below, same "no direct write policy" pattern as
-- shopping_list_items (docs/architecture/10-security-model.md §1).
create policy favorite_items_select_own on public.favorite_items
  for select using (user_id = (select auth.uid()));

create or replace function public.toggle_favorite_item(p_product_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_existed boolean;
begin
  if v_uid is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  delete from favorite_items where user_id = v_uid and product_id = p_product_id
  returning true into v_existed;

  if v_existed then
    return false;
  end if;

  insert into favorite_items (user_id, product_id) values (v_uid, p_product_id);
  return true;
end;
$$;

revoke all on function public.toggle_favorite_item(uuid) from public, anon;
grant execute on function public.toggle_favorite_item(uuid) to authenticated;

commit;
