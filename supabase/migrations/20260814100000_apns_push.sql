-- Machla — Apple Push Notification service (APNs) alongside Web Push.
--
-- WHY THIS EXISTS AT ALL
--
-- Web Push covers every browser this app runs in, and it covers the iOS
-- home-screen PWA too (Safari 16.4+). It does NOT cover an App Store
-- build: an app whose UI is a WKWebView gets no Push API, because Safari
-- grants that only to a site the user installed themselves. Apple's
-- position is that a native app asks APNs directly. So the App Store
-- build needs a second transport — not a second notification system.
--
-- ONE FAN-OUT, TWO TRANSPORTS
--
-- 20260812140000_push_notifications.sql set the rule this follows:
-- push is "a reader of this table rather than a second, parallel
-- notification path that can disagree with it". Adding a whole
-- device_tokens table next to push_subscriptions would have broken that
-- — two joins, two loops, two chances for an iPhone and an Android in
-- the same household to be told different things about the same list.
--
-- So an APNs device is just another push_subscriptions row:
--
--   platform = 'web'  endpoint is the push service URL, p256dh/auth_key
--                     are the browser's encryption keys
--   platform = 'ios'  endpoint is 'apns://<hex device token>',
--                     p256dh/auth_key are null
--
-- `endpoint` stays the unique key and keeps meaning exactly what it
-- meant before — "this one installation's address" — so the existing
-- upsert-on-endpoint, delete-on-endpoint, and prune-when-the-service-
-- says-it-is-dead paths all work unchanged for both transports.

begin;

-- ============================================================
-- Subscriptions: which transport is this row for
-- ============================================================

alter table public.push_subscriptions
  add column if not exists platform text not null default 'web';

-- Named constraints, dropped first, so re-running this migration against
-- a project that already has it is a no-op rather than a duplicate.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_platform_check;
alter table public.push_subscriptions
  add constraint push_subscriptions_platform_check
  check (platform in ('web', 'ios'));

-- An APNs row has no encryption keys — the transport is TLS to Apple
-- plus a signed JWT, not per-subscription ECDH.
alter table public.push_subscriptions alter column p256dh drop not null;
alter table public.push_subscriptions alter column auth_key drop not null;

-- ...but a web row without them is unsendable, and the NOT NULLs above
-- were the only thing preventing one. This keeps that guarantee for the
-- rows it still applies to instead of dropping it for everyone.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_web_keys;
alter table public.push_subscriptions
  add constraint push_subscriptions_web_keys
  check (platform <> 'web' or (p256dh is not null and auth_key is not null));

comment on column public.push_subscriptions.platform is
  'Which push transport this row addresses: web (Web Push, endpoint is '
  'the push service URL) or ios (APNs, endpoint is apns://<device token>). '
  'Defaults to web so every row that predates APNs support is correct.';

-- ============================================================
-- Fan-out: tell the sender which transport each recipient needs
-- ============================================================

-- Return type gains a column, so this is a drop-and-recreate rather than
-- a replace — same reason 20260812150000 had to drop it to add
-- is_household_side.
drop function if exists public.get_pending_pushes(uuid, text);

create function public.get_pending_pushes(p_list_id uuid, p_type text)
returns table (
  notification_id uuid,
  user_id uuid,
  endpoint text,
  p256dh text,
  auth_key text,
  actor_name text,
  preferred_language text,
  is_household_side boolean,
  -- Not `platform`: an OUT parameter sharing a name with a column in the
  -- body's own query is exactly the ambiguity plpgsql's default
  -- variable_conflict = error refuses to guess at.
  push_platform text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  return query
  select
    n.id,
    n.user_id,
    ps.endpoint,
    ps.p256dh,
    ps.auth_key,
    n.actor_name,
    u.preferred_language,
    exists (
      select 1
      from household_members hm
      where hm.household_id = n.household_id
        and hm.user_id = n.user_id
        and hm.status = 'active'
        and hm.role in ('owner', 'member')
    ),
    ps.platform
  from notifications n
  join push_subscriptions ps on ps.user_id = n.user_id
  join users u on u.id = n.user_id
  where n.list_id = p_list_id
    and n.type = p_type
    and n.actor_user_id = auth.uid()
    and n.pushed_at is null;
end;
$$;

revoke all on function public.get_pending_pushes(uuid, text) from public, anon;
grant execute on function public.get_pending_pushes(uuid, text) to authenticated;

commit;
