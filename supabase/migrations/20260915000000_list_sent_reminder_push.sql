-- Machla — second push for an unopened "list sent" notification.
--
-- WHY THIS EXISTS
--
-- sendPendingPushes (20260812140000_push_notifications.sql) already pushes
-- once, right when the worker sends a list. That push can go unseen —
-- phone on silent, notification swiped away, app never reopened — and
-- nothing today ever follows up. This adds exactly one nudge: if a
-- `list_sent` notification is still unread a while after its first push,
-- send it again.
--
-- WHY A SEPARATE COLUMN, NOT A NEW `type`
--
-- The reminder is not a new kind of event — it is the same "a list is
-- waiting for you" fact, re-delivered. Reusing `list_sent` (same
-- notification row, same in-app entry, same tap target) means no change
-- to the `type` check constraint, `NotificationType`, BODY_KEYS, or the
-- 12 locale files' `notif.*` key set. `reminder_sent_at` only records
-- whether THIS row's one allowed nudge has gone out.
--
-- WHY NO NEW RPC
--
-- Every existing push RPC (get_pending_pushes, mark_pushes_sent) is
-- scoped to `actor_user_id = auth.uid()` — deliberately, since it reads
-- back the CALLER's own fallout right after their own action. A reminder
-- scan has no caller: it runs from a scheduled job, sweeping stale rows
-- across every household at once. That is exactly the shape
-- lib/supabase/admin.ts's service-role client exists for (already used
-- the same way by lib/auth/deleteAccount.ts) — see app/api/cron/
-- list-reminders/route.ts.

begin;

alter table public.notifications
  add column if not exists reminder_sent_at timestamptz;

comment on column public.notifications.reminder_sent_at is
  'When the one-time follow-up push for this still-unread list_sent '
  'notification was attempted. Set once the reminder sweep has looked at '
  'a row (lib/push/send.ts sendListSentReminders), whether or not a '
  'device was actually reachable, so a recipient with push disabled is '
  'not rescanned on every run. NULL means no reminder has gone out yet.';

-- Matches the reminder sweep's own where-clause exactly, so the scan
-- stays an index lookup instead of a seq scan as `notifications` grows.
create index if not exists notifications_reminder_pending_idx
  on public.notifications (pushed_at)
  where type = 'list_sent'
    and read_at is null
    and reminder_sent_at is null
    and pushed_at is not null;

commit;
