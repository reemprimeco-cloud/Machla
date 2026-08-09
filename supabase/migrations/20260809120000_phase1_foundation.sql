-- HomeList — Phase 1 foundation migration
--
-- Implements the schema proposed in docs/architecture/03-database-schema.md
-- and the RLS strategy in docs/architecture/10-security-model.md.
--
-- Scope note: this migration creates every core table, enables Row Level
-- Security everywhere, and adds only the SELECT policies (plus a user's
-- own-row UPDATE) that are safe as plain ownership/membership checks. It
-- deliberately does NOT add INSERT/UPDATE/DELETE policies for
-- household_members, household_invitations, households, categories,
-- products, shopping_lists, or shopping_list_items — those tables are
-- mutated only through SECURITY DEFINER RPC functions (create_household,
-- create_invitation, accept_invitation, set_purchase_status, etc.) added
-- in the phases that implement each feature (Phase 3/4/5/6/7/8), per the
-- "no direct client writes" design in docs/architecture/10-security-model.md
-- §3-4. Until those RPCs exist, those tables are read-only to clients.

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- users
-- ============================================================

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  phone_number text not null unique,
  role text not null default 'worker' check (role in ('owner', 'member', 'worker')),
  preferred_language text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'Mirrors auth.users 1:1. role is a UI/persona hint only — never the '
  'authorization source of truth (see household_members.role and '
  'docs/architecture/04-roles-permission-matrix.md).';

-- ============================================================
-- households
-- ============================================================

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.households is
  'No searchable/public code column by design — households are never '
  'discoverable (master plan Section 15).';

-- ============================================================
-- household_members
-- ============================================================

create table if not exists public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'worker')),
  status text not null default 'active' check (status in ('active', 'removed')),
  invited_by_user_id uuid references public.users (id),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- Exactly one active owner per household.
create unique index if not exists household_members_one_active_owner
  on public.household_members (household_id)
  where role = 'owner' and status = 'active';

create index if not exists household_members_household_status_idx
  on public.household_members (household_id, status);
create index if not exists household_members_user_status_idx
  on public.household_members (user_id, status);

-- ============================================================
-- household_invitations
-- ============================================================

create table if not exists public.household_invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('member', 'worker')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  max_uses int not null default 1,
  created_by_user_id uuid not null references public.users (id),
  used_by_user_id uuid references public.users (id),
  used_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create index if not exists household_invitations_household_status_idx
  on public.household_invitations (household_id, status);

-- ============================================================
-- categories
-- ============================================================

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  name_en text not null,
  name_ar text not null,
  name_hi text not null,
  name_te text not null,
  name_ur text not null,
  name_fil text not null,
  name_ne text not null,
  name_id text not null,
  name_si text not null
);

comment on table public.categories is
  'sort_order drives the deterministic default category grouping order '
  '(master plan Section 16A). Seeded with V1 categories in Phase 5.';

-- ============================================================
-- products
-- ============================================================

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  subcategory_id uuid references public.categories (id),
  brand text,
  name_en text not null,
  name_ar text not null,
  name_hi text not null,
  name_te text not null,
  name_ur text not null,
  name_fil text not null,
  name_ne text not null,
  name_id text not null,
  name_si text not null,
  size text,
  unit text not null check (
    unit in ('pcs', 'kg', 'g', 'l', 'ml', 'pack', 'box', 'bottle', 'bag', 'other')
  ),
  image_url text,
  image_source_url text,
  source_name text,
  barcode text,
  sku text,
  search_keywords text[],
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.products.image_source_url is
  'Reference page metadata was curated from (e.g. Sharq Coop, Deliveroo '
  'Kuwait) — traceability only, never scraped/hotlinked at request time. '
  'See docs/architecture/11-product-catalog-architecture.md.';

create index if not exists products_category_active_sort_idx
  on public.products (category_id, is_active, sort_order);
create index if not exists products_search_keywords_gin_idx
  on public.products using gin (search_keywords);

-- No price column exists anywhere in this schema — structurally absent,
-- not filtered out (master plan: never import prices).

-- ============================================================
-- product_usage_stats  ("My Usual Items", master plan Section 19)
-- ============================================================

create table if not exists public.product_usage_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  selection_count int not null default 0,
  last_selected_at timestamptz,
  unique (user_id, product_id)
);

-- ============================================================
-- shopping_lists
-- ============================================================

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  created_by_user_id uuid not null references public.users (id),
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'viewed', 'completed', 'archived')
  ),
  language text not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  viewed_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists shopping_lists_household_status_created_idx
  on public.shopping_lists (household_id, status, created_at desc);

-- ============================================================
-- shopping_list_items
-- ============================================================

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists (id) on delete cascade,
  product_id uuid not null references public.products (id),
  category_id uuid not null references public.categories (id),
  quantity numeric not null default 1 check (quantity > 0),
  unit text not null,
  note text,
  sort_order int not null default 0,
  purchase_status text not null default 'pending' check (
    purchase_status in ('pending', 'purchased', 'unavailable')
  ),
  purchased_at timestamptz,
  purchased_by_user_id uuid references public.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.shopping_list_items.category_id is
  'Snapshot of products.category_id at add-time — intentionally NOT a '
  'live join, so historical/completed lists keep their original grouping '
  'even if a product is later re-categorized. See master plan Section '
  '16A.4 and docs/architecture/13-shopping-list-grouping-checklist.md §4.';

comment on column public.shopping_list_items.purchase_status is
  'Owner/member purchase-execution state, independent of the worker''s '
  'original request. Written only via a future set_purchase_status RPC, '
  'which never touches product_id/quantity/unit/note/category_id.';

create index if not exists shopping_list_items_list_category_sort_idx
  on public.shopping_list_items (list_id, category_id, sort_order);

-- ============================================================
-- auth.users -> public.users provisioning trigger
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, phone_number)
  values (new.id, coalesce(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RLS helper
-- ============================================================

create or replace function public.is_active_member(p_household_id uuid, p_roles text[] default null)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.user_id = auth.uid()
      and hm.status = 'active'
      and (p_roles is null or hm.role = any (p_roles))
  );
$$;

comment on function public.is_active_member is
  'Single source of truth for "is the current user an active member of '
  'this household (optionally with one of these roles)". Backs every RLS '
  'policy below — see docs/architecture/10-security-model.md §2.';

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.users enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invitations enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_usage_stats enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;

-- users: a user can only ever see/edit their own profile row. No policy
-- exposes other users' rows directly (household-scoped visibility of
-- other members is a Phase 4 concern, via a restricted view/RPC — see
-- docs/architecture/10-security-model.md §3).
create policy users_select_own on public.users
  for select using (id = auth.uid());

create policy users_update_own on public.users
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- households: visible only to active members.
create policy households_select_member on public.households
  for select using (public.is_active_member(id));

-- household_members: visible to fellow active members of the same
-- household (so "who else is in this household" works).
create policy household_members_select_member on public.household_members
  for select using (public.is_active_member(household_id));

-- household_invitations: owner-only visibility. Invitees never read this
-- table directly — they go through a preview/accept RPC (Phase 4) that
-- returns only {household_name, role}.
create policy household_invitations_select_owner on public.household_invitations
  for select using (public.is_active_member(household_id, array['owner']));

-- categories / products: public, read-only catalog data. No price column
-- exists; writes are service-role only (the Phase 5 import pipeline).
create policy categories_select_all on public.categories
  for select using (true);

create policy products_select_all on public.products
  for select using (true);

-- product_usage_stats: a user can see only their own usage counters.
create policy product_usage_stats_select_own on public.product_usage_stats
  for select using (user_id = auth.uid());

-- shopping_lists: visible only to active members of the owning household.
create policy shopping_lists_select_member on public.shopping_lists
  for select using (public.is_active_member(household_id));

-- shopping_list_items: visible only to active members of the household
-- that owns the parent list.
create policy shopping_list_items_select_member on public.shopping_list_items
  for select using (
    exists (
      select 1
      from public.shopping_lists sl
      where sl.id = list_id
        and public.is_active_member(sl.household_id)
    )
  );

commit;
