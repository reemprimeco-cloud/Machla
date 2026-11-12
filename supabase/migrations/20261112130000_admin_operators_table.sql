-- Machla — derive admin status from a table no user can write, instead of
-- from public.users.email / phone_number (2026-11-12 security audit).
--
-- Those two columns are self-editable under users_update_own (row-scoped,
-- not column-scoped), so any account could claim the operator's email and
-- pass is_admin_operator(). 20261112120000_block_admin_identity_claim.sql
-- closed that with a trigger as a stopgap; this is the durable fix.
--
-- admin_operators has RLS enabled and no policy at all, plus an explicit
-- revoke: nothing reachable by anon/authenticated can read or write it.
-- Only is_admin_operator() (SECURITY DEFINER) reads it, and only the
-- service role / a migration can add a row. Every admin_* function and
-- both product-images storage policies already call is_admin_operator(),
-- so repointing its body moves all of them at once.
--
-- The stopgap trigger stays for now. Until the app-side gate
-- (lib/admin/guard.ts) is deployed reading is_admin_operator() too, the
-- live requireAdminAccess() still trusts the email/phone columns — and
-- lib/admin/broadcast.ts pushes to every subscriber behind that gate
-- alone. A follow-up migration drops the trigger once that deploy is live.

begin;

create table if not exists public.admin_operators (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_operators enable row level security;
revoke all on public.admin_operators from public, anon, authenticated;

-- Seeded from the phone number the stopgap trigger has guaranteed no
-- other row could acquire — not a hardcoded generated id.
insert into public.admin_operators (user_id)
select id from public.users where phone_number = '96565068000'
on conflict (user_id) do nothing;

do $$
begin
  if (select count(*) from public.admin_operators) <> 1 then
    raise exception 'admin_operators seed expected exactly 1 row, aborting to avoid a lockout';
  end if;
end;
$$;

create or replace function public.is_admin_operator()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from admin_operators where user_id = auth.uid()
  );
end;
$$;

commit;
