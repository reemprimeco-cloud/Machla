-- push_subscriptions_own (20260812140000_push_notifications.sql) was
-- added after 20260809210000_phase10_performance.sql fixed every other
-- policy's `auth.uid()` to `(select auth.uid())` — wrapped in a scalar
-- subquery so Postgres evaluates it once per query instead of once per
-- row (lint 0003_auth_rls_initplan) — and missed that convention. Same
-- fix, same reason.

begin;

drop policy if exists push_subscriptions_own on public.push_subscriptions;

create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

commit;
