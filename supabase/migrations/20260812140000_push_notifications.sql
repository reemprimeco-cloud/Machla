-- HomeList — Push notifications.
--
-- 20260809200000_phase8_notifications.sql explicitly deferred this:
-- "Browser push itself is listed as optional... and is NOT built here"
-- — and designed the notifications table so that whenever it did get
-- built, push would be "a reader of this table rather than a second,
-- parallel notification path that can disagree with it." This migration
-- is exactly that: no new notification logic, just a way to also tell a
-- phone about a row the existing trigger already decided to create.
--
-- WHY THIS IS APP-LAYER, NOT A DATABASE WEBHOOK
--
-- The obvious "correct" design is a trigger that fires a webhook (pg_net)
-- to an Edge Function on every notifications insert. That was rejected
-- for this project: it needs a deployed Edge Function, a webhook
-- configuration, and the VAPID private key stored as a second secret in a
-- second place, all invisible to `supabase/migrations` — exactly the kind
-- of infrastructure that only becomes visible when it silently breaks.
--
-- Instead, sending happens from the same Next.js Server Actions that
-- already trigger the notification (sendListAction, markListViewedAction,
-- setListCompletedAction, lib/list/actions.ts) — best-effort, after the
-- RPC that changed the list's status returns. The two RPCs below are the
-- only new authorization surface this needs: one to read back which
-- rows THIS caller's own action just created (so the client can never
-- use it to enumerate someone else's push subscriptions), and one to
-- mark them sent.

begin;

-- ============================================================
-- Subscriptions
-- ============================================================

-- One row per (browser, device). A user with the app open on two phones
-- has two rows; RLS scopes both to them, no RPC needed for the ordinary
-- subscribe/unsubscribe path — a plain client-side upsert/delete is
-- authorized the same way editing your own users row already is
-- (Phase 1: docs/architecture/10-security-model.md §1).
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- The push service URL itself is the natural unique key: it identifies
  -- one browser's one subscription, regardless of which account is
  -- currently signed in on that device. Re-subscribing (e.g. the browser
  -- rotated its keys) upserts on this rather than accumulating dead rows.
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ============================================================
-- Which notifications still need pushing
-- ============================================================

alter table public.notifications
  add column if not exists pushed_at timestamptz;

comment on column public.notifications.pushed_at is
  'When a push was successfully dispatched for this row. Set by the '
  'Next.js action that triggered the underlying status change, via '
  'mark_pushes_sent — not by the trigger that created the row, which '
  'has no way to reach a push service.';

-- Returns the caller's own action's fallout: every push-eligible
-- notification (household member has a subscription) created by the
-- CALLER'S most recent action on this list, not yet pushed. Scoped to
-- `actor_user_id = auth.uid()` — the caller can only ever read back
-- recipients of their own action, never browse anyone else's
-- notifications or subscriptions. That is not a new capability: they
-- already know who is in their household (get_household_members) and
-- that they just performed this action.
create or replace function public.get_pending_pushes(p_list_id uuid, p_type text)
returns table (
  notification_id uuid,
  user_id uuid,
  endpoint text,
  p256dh text,
  auth_key text,
  actor_name text,
  preferred_language text
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
  select n.id, n.user_id, ps.endpoint, ps.p256dh, ps.auth_key, n.actor_name, u.preferred_language
  from notifications n
  join push_subscriptions ps on ps.user_id = n.user_id
  join users u on u.id = n.user_id
  where n.list_id = p_list_id
    and n.type = p_type
    and n.actor_user_id = auth.uid()
    and n.pushed_at is null;
end;
$$;

create or replace function public.mark_pushes_sent(p_notification_ids uuid[])
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  -- actor_user_id filter is what makes this safe to expose: an id
  -- belonging to a notification the caller didn't cause simply matches
  -- nothing, the same pattern mark_notifications_read uses for user_id.
  update notifications n
  set pushed_at = now()
  where n.id = any (p_notification_ids)
    and n.actor_user_id = auth.uid()
    and n.pushed_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.get_pending_pushes(uuid, text) from public, anon;
revoke all on function public.mark_pushes_sent(uuid[]) from public, anon;

grant execute on function public.get_pending_pushes(uuid, text) to authenticated;
grant execute on function public.mark_pushes_sent(uuid[]) to authenticated;

commit;
