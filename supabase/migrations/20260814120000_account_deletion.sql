-- Self-service account deletion.
--
-- WHY THIS EXISTS
--
-- Apple Guideline 5.1.1(v): an app that lets someone create an account
-- must also let them delete it, from inside the app, and it must be a
-- real deletion — not a deactivation. This was missing entirely; the App
-- Review request that flagged the gap is what prompted this migration.
--
-- WHAT "DELETE MY ACCOUNT" MEANS HERE
--
-- The owner decision (2026-08-14): if the caller owns a household,
-- deleting their account deletes that household and everything in it —
-- its lists, its members, its invitations — for everyone, not just the
-- caller. A household with no owner is not a state this schema is built
-- to represent (every household has exactly one), so there is no softer
-- middle ground like "reassign ownership" without a second, separate
-- decision about who it reassigns to and whether they'd want that.
--
-- If the caller is only a member or worker elsewhere (not the owner),
-- deleting their account leaves those households and their lists alone
-- for everyone else — only the caller's own membership, and their own
-- authorship of things within them, goes away.
--
-- THE SHAPE OF THE FIX: SET NULL WHERE HISTORY SHOULD OUTLIVE THE ROW,
-- CASCADE WHERE IT SHOULDN'T
--
-- `notifications.actor_user_id` already uses SET NULL for exactly this
-- reason: the notification ("List sent") is worth keeping after the
-- person who sent it is gone, same as `hlists.someone` is already the
-- app's fallback for an unknown actor. Three more columns needed the
-- same treatment for account deletion to be possible at all, because
-- they are FOREIGN KEY ... ON DELETE NO ACTION today:
--
--   shopping_lists.created_by_user_id     (was NOT NULL; relaxed below)
--   shopping_list_items.purchased_by_user_id
--   household_invitations.used_by_user_id
--
-- NO ACTION means Postgres refuses to delete a `users` row while any of
-- these still point at it — which every non-owner who ever built a list,
-- ticked off a purchase, or accepted an invite in someone else's
-- household would, permanently blocking their own account deletion.
--
-- `household_invitations.created_by_user_id` is deliberately NOT changed:
-- invitations are owner-only to create (`SettingsScreen.tsx`'s own
-- comment says so), so that row is always inside a household the same
-- owner still owns — and this migration's RPC deletes owned households
-- (which cascades their invitations) before the caller's own user row
-- is ever removed. That NO ACTION can never actually fire, and leaving
-- it in place keeps it as a real safety net against a bug that would
-- otherwise silently orphan a household's invitations under someone
-- other than its true creator.
--
-- `households.owner_user_id` is untouched for the same reason, the
-- other direction: it is NO ACTION on purpose, so that ANY code path
-- which forgets to delete a user's owned households first fails loudly
-- instead of leaving a household pointing at nobody.

begin;

-- ============================================================
-- Let authorship/attribution outlive the author, where the record
-- itself is meant to.
-- ============================================================

alter table public.shopping_lists
  alter column created_by_user_id drop not null;

alter table public.shopping_lists
  drop constraint if exists shopping_lists_created_by_user_id_fkey;
alter table public.shopping_lists
  add constraint shopping_lists_created_by_user_id_fkey
  foreign key (created_by_user_id) references public.users(id) on delete set null;

comment on column public.shopping_lists.created_by_user_id is
  'Who built this list. Nullable: set null if that user later deletes '
  'their account (ON DELETE SET NULL) — the list and its items survive '
  'for the rest of the household; the UI already falls back to '
  'hlists.someone for a null creator name.';

alter table public.shopping_list_items
  drop constraint if exists shopping_list_items_purchased_by_user_id_fkey;
alter table public.shopping_list_items
  add constraint shopping_list_items_purchased_by_user_id_fkey
  foreign key (purchased_by_user_id) references public.users(id) on delete set null;

alter table public.household_invitations
  drop constraint if exists household_invitations_used_by_user_id_fkey;
alter table public.household_invitations
  add constraint household_invitations_used_by_user_id_fkey
  foreign key (used_by_user_id) references public.users(id) on delete set null;

-- ============================================================
-- The RPC
-- ============================================================
--
-- Deletes every household the caller owns (cascading their members,
-- lists, items, invitations, and household-scoped notifications with
-- them) and hands back the photo paths that were about to go with them,
-- because storage.objects cannot be deleted from SQL — Supabase's own
-- storage.protect_delete trigger forbids it, the same constraint
-- 20260810160000_photo_retention.sql already worked around once. The
-- caller (a Server Action, using the service role) purges those blobs
-- and then deletes the auth.users row itself via the Admin API, which
-- cascades to public.users (ON DELETE CASCADE already) and from there to
-- every remaining table that referenced the caller directly
-- (household_members, notifications, push_subscriptions,
-- product_usage_stats — all already ON DELETE CASCADE on user_id).
--
-- Why this function does not delete public.users itself: it runs with
-- the CALLER's own session, which is about to be invalidated by the
-- Admin API call that comes right after it — deleting auth.users is the
-- only step that actually needs elevated privilege, so it is the only
-- step kept out of this RPC.
create or replace function public.delete_own_account()
returns table(photo_path text)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  create temporary table _pending_photo_purge on commit drop as
  select sli.photo_path as path
  from shopping_list_items sli
  join shopping_lists sl on sl.id = sli.list_id
  join households h on h.id = sl.household_id
  where h.owner_user_id = auth.uid()
    and sli.photo_path is not null
    and sli.photo_deleted_at is null;

  delete from households where owner_user_id = auth.uid();

  return query select path from _pending_photo_purge;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

commit;
