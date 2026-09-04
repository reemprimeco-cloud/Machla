-- Per-household annual subscription (one paid plan covers everyone in the
-- household — the Worker side stays free regardless, since none of this
-- touches shopping_lists/is_active_member's worker path).
--
-- A household gets a 14-day free trial from the moment it exists, then
-- needs an active Apple subscription. Existing households (created before
-- this migration) are backfilled with a fresh 14-day trial starting now,
-- rather than one backdated to their own created_at — nobody who was
-- already using the app for free loses access the instant this ships,
-- before there is even a subscription product in App Store Connect to buy.

begin;

alter table households
  add column trial_ends_at timestamptz,
  add column subscription_status text not null default 'none'
    check (subscription_status in ('none', 'active', 'grace_period', 'expired', 'revoked')),
  add column subscription_period_end timestamptz,
  add column apple_original_transaction_id text unique;

comment on column households.trial_ends_at is
  'Free trial deadline. Ignored once subscription_status is anything but ''none''.';
comment on column households.subscription_status is
  'Apple''s own subscription lifecycle state for this household''s paid plan (App Store Server API "status" field: 1 active, 2 expired, 3 billing retry, 4 grace period, 5 revoked, mapped down to active/expired/grace_period/revoked here), or ''none'' before any purchase.';
comment on column households.subscription_period_end is
  'Current paid period end, from Apple. Only meaningful while subscription_status = ''active'' or ''grace_period''.';
comment on column households.apple_original_transaction_id is
  'Links this household to the Apple subscription paying for it — Apple''s originalTransactionId, stable across renewals.';

update households set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;

alter table households
  alter column trial_ends_at set not null,
  alter column trial_ends_at set default (now() + interval '14 days');

-- Whether this household currently has paid access: an active/grace-period
-- Apple subscription, or (before any purchase) still inside its free
-- trial window. One definition so the app-gate and the paywall/settings
-- display can never disagree about what "has access" means.
create or replace function public.household_has_access(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when h.subscription_status in ('active', 'grace_period') then true
    when h.subscription_status = 'none' and now() < h.trial_ends_at then true
    else false
  end
  from households h
  where h.id = p_household_id;
$$;

revoke all on function public.household_has_access(uuid) from public, anon;
grant execute on function public.household_has_access(uuid) to authenticated;

-- Records what Apple told the server about this household's subscription
-- (lib/subscription/apple.ts calls this after a purchase, and on lazy
-- re-checks when the cached period_end has passed). Owner/member only,
-- same authorization every other household-side write already uses —
-- households itself carries no UPDATE policy at all, only this kind of
-- RPC.
create or replace function public.link_apple_subscription(
  p_household_id uuid,
  p_original_transaction_id text,
  p_status text,
  p_period_end timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_active_member(p_household_id, array['owner', 'member']) then
    raise exception 'NOT_HOUSEHOLD_SIDE' using errcode = '42501';
  end if;

  update households
  set apple_original_transaction_id = p_original_transaction_id,
      subscription_status = p_status,
      subscription_period_end = p_period_end,
      updated_at = now()
  where id = p_household_id;
end;
$$;

revoke all on function public.link_apple_subscription(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.link_apple_subscription(uuid, text, text, timestamptz) to authenticated;

commit;
