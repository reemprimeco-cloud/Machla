-- HomeList — Phase 4: households, invitations, membership
--
-- Implements docs/architecture/05-household-model.md,
-- 07-invitation-flow.md, and the RPC-boundary design in
-- 10-security-model.md §1/§3.
--
-- Every mutation below is a SECURITY DEFINER function that performs its
-- own authorization check. The Phase 1 migration deliberately granted no
-- INSERT/UPDATE/DELETE policies on households, household_members, or
-- household_invitations, so these functions are the ONLY write paths
-- into those tables — a client holding the anon key cannot bypass them.

begin;

-- ============================================================
-- Invitation codes (07-invitation-flow.md §2)
-- ============================================================

-- Crockford base32: no I, L, O, or U. I/L/O can be confused with 1/1/0
-- when read aloud or typed; U is excluded so a generated code can't spell
-- something unfortunate. 8 chars x 32 symbols = 40 bits of entropy.
create or replace function public.generate_invitation_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    -- floor(random()*32) is 0..31; substr is 1-indexed.
    result := result || substr(alphabet, floor(random() * 32)::int + 1, 1);
  end loop;
  return result;
end;
$$;

-- Accepts what a human actually types: lowercase, hyphens/spaces from the
-- "K7P4-M2" display format, and the classic Crockford confusions
-- (O -> 0, I/L -> 1). Anything else non-alphanumeric is stripped.
create or replace function public.normalize_invitation_code(p_code text)
returns text
language sql
immutable
as $$
  select translate(
    regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g'),
    'OIL',
    '011'
  );
$$;

comment on function public.normalize_invitation_code is
  'Canonicalizes a user-typed invitation code before lookup. Generated '
  'codes never contain O/I/L/U, so mapping O->0 and I/L->1 only ever '
  'fixes a typo — it can never collide two distinct real codes.';

-- ============================================================
-- create_household
-- ============================================================

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_household_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if length(v_name) = 0 or length(v_name) > 80 then
    raise exception 'INVALID_NAME' using errcode = '22023';
  end if;

  insert into households (name, owner_user_id)
  values (v_name, v_user_id)
  returning id into v_household_id;

  insert into household_members (household_id, user_id, role, status)
  values (v_household_id, v_user_id, 'owner', 'active');

  -- users.role is a UI/persona hint only, never an authorization source
  -- (04-roles-permission-matrix.md §1). Set it so this user's next login
  -- lands on the household experience by default.
  update users set role = 'owner', updated_at = now() where id = v_user_id;

  return v_household_id;
end;
$$;

-- ============================================================
-- create_invitation  (Owner only)
-- ============================================================

create or replace function public.create_invitation(
  p_household_id uuid,
  p_role text,
  p_expires_in_days int default 7
)
returns table (id uuid, code text, role text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_days int := coalesce(p_expires_in_days, 7);
  v_attempt int := 0;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not is_active_member(p_household_id, array['owner']) then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  -- Only these two roles are invitable: a household has exactly one
  -- owner, created via create_household (05-household-model.md §2).
  if p_role is null or p_role not in ('member', 'worker') then
    raise exception 'INVALID_ROLE' using errcode = '22023';
  end if;

  if v_days < 1 or v_days > 30 then
    raise exception 'INVALID_EXPIRY' using errcode = '22023';
  end if;

  -- Retry on the (astronomically unlikely) code collision rather than
  -- letting the unique constraint surface as a 500.
  loop
    v_attempt := v_attempt + 1;
    v_code := generate_invitation_code();
    exit when not exists (select 1 from household_invitations hi where hi.code = v_code);
    if v_attempt >= 10 then
      raise exception 'CODE_GENERATION_FAILED' using errcode = '55000';
    end if;
  end loop;

  return query
  insert into household_invitations (
    household_id, code, role, status, max_uses, created_by_user_id, expires_at
  )
  values (
    p_household_id, v_code, p_role, 'pending', 1, v_user_id, now() + make_interval(days => v_days)
  )
  returning
    household_invitations.id,
    household_invitations.code,
    household_invitations.role,
    household_invitations.expires_at;
end;
$$;

-- ============================================================
-- revoke_invitation  (Owner only)
-- ============================================================

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_status text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select hi.household_id, hi.status
    into v_household_id, v_status
  from household_invitations hi
  where hi.id = p_invitation_id;

  if v_household_id is null then
    raise exception 'INVITATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not is_active_member(v_household_id, array['owner']) then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  -- Only a still-pending invitation can be revoked; accepted/expired/
  -- already-revoked codes are permanently dead either way
  -- (07-invitation-flow.md §5).
  if v_status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING' using errcode = '22023';
  end if;

  update household_invitations
  set status = 'revoked'
  where id = p_invitation_id;
end;
$$;

-- ============================================================
-- preview_invitation  (any authenticated user holding a code)
-- ============================================================

-- Read-only. Returns the bare minimum needed to render the master plan's
-- "You are joining: Reem's Home / Role: Domestic Worker" confirmation —
-- never the invitation row, never any other household detail
-- (07-invitation-flow.md §4, §6.4). Returns zero rows for an invalid,
-- expired, revoked, or already-used code; the caller cannot distinguish
-- between those cases, which is deliberate.
create or replace function public.preview_invitation(p_code text)
returns table (household_name text, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  return query
  select h.name, hi.role
  from household_invitations hi
  join households h on h.id = hi.household_id
  where hi.code = normalize_invitation_code(p_code)
    and hi.status = 'pending'
    and hi.expires_at > now();
end;
$$;

-- ============================================================
-- accept_invitation  (any authenticated user holding a code)
-- ============================================================

create or replace function public.accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation household_invitations%rowtype;
  v_existing_status text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- FOR UPDATE holds the row for the rest of this transaction, so two
  -- concurrent redemptions of the same single-use code serialize here and
  -- the second one sees status='accepted' (10-security-model.md §5).
  select * into v_invitation
  from household_invitations
  where code = normalize_invitation_code(p_code)
  for update;

  if v_invitation.id is null then
    raise exception 'INVALID_CODE' using errcode = 'P0002';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'INVITATION_NOT_PENDING' using errcode = '22023';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED' using errcode = '22023';
  end if;

  select hm.status into v_existing_status
  from household_members hm
  where hm.household_id = v_invitation.household_id
    and hm.user_id = v_user_id;

  if v_existing_status = 'active' then
    -- Friendly no-op: already in this household. The invitation is left
    -- pending so it isn't silently burned by a double-tap
    -- (07-invitation-flow.md §4).
    return v_invitation.household_id;
  elsif v_existing_status = 'removed' then
    -- Previously removed, now re-invited: reactivate rather than
    -- violating the (household_id, user_id) unique constraint.
    update household_members
    set status = 'active',
        role = v_invitation.role,
        invited_by_user_id = v_invitation.created_by_user_id,
        joined_at = now(),
        updated_at = now()
    where household_id = v_invitation.household_id
      and user_id = v_user_id;
  else
    insert into household_members (
      household_id, user_id, role, status, invited_by_user_id
    )
    values (
      v_invitation.household_id, v_user_id, v_invitation.role, 'active',
      v_invitation.created_by_user_id
    );
  end if;

  update household_invitations
  set status = 'accepted',
      used_by_user_id = v_user_id,
      used_at = now()
  where id = v_invitation.id;

  -- Persona hint only (see create_household). Don't clobber an existing
  -- owner persona if this user also owns a household of their own.
  update users
  set role = v_invitation.role, updated_at = now()
  where id = v_user_id
    and role is distinct from 'owner';

  return v_invitation.household_id;
end;
$$;

-- ============================================================
-- remove_household_member  (Owner only)
-- ============================================================

create or replace function public.remove_household_member(
  p_household_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_role text;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not is_active_member(p_household_id, array['owner']) then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;

  select hm.role into v_target_role
  from household_members hm
  where hm.household_id = p_household_id
    and hm.user_id = p_user_id
    and hm.status = 'active';

  if v_target_role is null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- A household is never left without its owner (05-household-model.md
  -- §2 invariant 2). Ownership transfer is explicitly out of scope for
  -- V1 (14-technical-risks-decisions.md item 11).
  if v_target_role = 'owner' then
    raise exception 'CANNOT_REMOVE_OWNER' using errcode = '42501';
  end if;

  -- Soft delete: preserves shopping_lists.created_by_user_id history so
  -- the owner can still answer "who sent this list" later
  -- (05-household-model.md §2 invariant 4). is_active_member() filters on
  -- status, so access is revoked immediately.
  update household_members
  set status = 'removed', updated_at = now()
  where household_id = p_household_id
    and user_id = p_user_id;
end;
$$;

-- ============================================================
-- get_household_members  (Owner/Member only)
-- ============================================================

-- Deliberately exposes no phone number: 10-security-model.md §3 limits
-- cross-member visibility of the users table to id/display_name/role.
-- Workers are excluded entirely per the permission matrix
-- (04-roles-permission-matrix.md: Worker cannot view the member list).
create or replace function public.get_household_members(p_household_id uuid)
returns table (
  user_id uuid,
  display_name text,
  role text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not is_active_member(p_household_id, array['owner', 'member']) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return query
  select hm.user_id, u.display_name, hm.role, hm.joined_at
  from household_members hm
  join users u on u.id = hm.user_id
  where hm.household_id = p_household_id
    and hm.status = 'active'
  order by
    case hm.role when 'owner' then 0 when 'member' then 1 else 2 end,
    hm.joined_at;
end;
$$;

-- ============================================================
-- expire_stale_invitations  (scheduled maintenance)
-- ============================================================

-- Belt-and-suspenders on top of the runtime expiry checks in
-- preview_invitation/accept_invitation, so expired codes don't linger as
-- "pending" in the owner's invitation list (07-invitation-flow.md §5).
-- Intended to be scheduled (pg_cron / Supabase scheduled function) once a
-- live project exists; correctness does not depend on it running.
create or replace function public.expire_stale_invitations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update household_invitations
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ============================================================
-- RLS refinement: household_members SELECT
-- ============================================================

-- Phase 1 granted a single policy letting any active member read every
-- household_members row for their household. That conflicts with the
-- permission matrix, which says a Worker cannot view the member roster.
-- Split it: everyone can always read their OWN membership rows (the root
-- route needs this to decide which experience to render), while the full
-- roster is limited to owner/member.
drop policy if exists household_members_select_member on public.household_members;

create policy household_members_select_own on public.household_members
  for select using (user_id = auth.uid());

create policy household_members_select_roster on public.household_members
  for select using (public.is_active_member(household_id, array['owner', 'member']));

-- ============================================================
-- Grants
-- ============================================================

-- Postgres grants EXECUTE on new functions to PUBLIC by default. Revoke
-- that and re-grant only to authenticated, so an unauthenticated caller
-- holding the anon key cannot probe invitation codes.
revoke execute on function
  public.create_household(text),
  public.create_invitation(uuid, text, int),
  public.revoke_invitation(uuid),
  public.preview_invitation(text),
  public.accept_invitation(text),
  public.remove_household_member(uuid, uuid),
  public.get_household_members(uuid),
  public.expire_stale_invitations(),
  public.generate_invitation_code()
from public;

grant execute on function
  public.create_household(text),
  public.create_invitation(uuid, text, int),
  public.revoke_invitation(uuid),
  public.preview_invitation(text),
  public.accept_invitation(text),
  public.remove_household_member(uuid, uuid),
  public.get_household_members(uuid)
to authenticated;

-- normalize_invitation_code is a pure string helper with no data access;
-- it is used inside the functions above and is harmless to expose.
grant execute on function public.normalize_invitation_code(text) to authenticated, anon;

commit;
