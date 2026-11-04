-- Machla — cover the 9 unindexed foreign keys reported by Supabase's own
-- database linter (`get_advisors`, lint 0001_unindexed_foreign_keys),
-- flagged by the 2026-11-04 performance audit.
--
-- 20260809210000_phase10_performance.sql indexed the foreign keys that
-- existed at the time; every table/column added since (favorite_items,
-- app_feedback, push_subscriptions, households.owner_user_id,
-- notifications.actor_user_id, products.subcategory_id, and the two
-- shopping_list_items user-tracking columns) never got a follow-up.
-- Plain `CREATE INDEX IF NOT EXISTS`, not CONCURRENTLY — every table here
-- is tens to a few hundred rows, so a brief lock is not a real cost, and
-- CONCURRENTLY cannot run inside the transaction block Supabase wraps
-- migrations in.
--
-- notifications.actor_user_id and push_subscriptions.user_id sit on the
-- hot push/notification read paths (get_pending_pushes, notification
-- reads); households.owner_user_id sits behind frequent ownership checks.

begin;

create index if not exists app_feedback_user_id_idx
  on public.app_feedback (user_id);

create index if not exists favorite_items_product_id_idx
  on public.favorite_items (product_id);

create index if not exists household_invitations_used_by_user_id_idx
  on public.household_invitations (used_by_user_id);

create index if not exists households_owner_user_id_idx
  on public.households (owner_user_id);

create index if not exists notifications_actor_user_id_idx
  on public.notifications (actor_user_id);

create index if not exists products_subcategory_id_idx
  on public.products (subcategory_id);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create index if not exists shopping_list_items_added_by_user_id_idx
  on public.shopping_list_items (added_by_user_id);

create index if not exists shopping_list_items_purchased_by_user_id_idx
  on public.shopping_list_items (purchased_by_user_id);

commit;
