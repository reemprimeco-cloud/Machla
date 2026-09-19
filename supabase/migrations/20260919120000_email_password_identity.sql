-- ============================================================
-- Email/username + password identity, alongside phone + OTP
-- ============================================================
--
-- WHY THIS EXISTS
--
-- 06-auth-otp-flow.md and 20260810120000_phone_only_identity.sql made
-- phone the ONLY identity, by explicit owner decision, when OTP was the
-- app's only sign-in method. That decision is now superseded: OTP
-- restricts sign-up to numbers the SMS/WhatsApp provider can reach in one
-- country, and the owner (2026-09-19) wants sign-up open worldwide.
--
-- Dropping OTP outright would lock out every account already on this
-- database — 27 real households at the time of this migration — since
-- none of them has a password, and most have no email either. So this
-- lands in two steps:
--
--   Phase 1 (this migration + app code): existing phone+OTP accounts can
--   ADD an email/username + password to their existing account, while
--   OTP keeps working. Nothing is removed yet. handle_new_user() is
--   untouched — phone+OTP sign-up still works exactly as before.
--
--   Phase 2 (a later migration): /login switches to email/username +
--   password only, phone OTP is retired, and phone_number's NOT NULL
--   constraint is revisited for genuinely new sign-ups.
--
-- Two identifiers, one column each, because they serve different people:
--
--   - email: a real address, for owners/members who have one and want
--     "forgot password" to actually reach them.
--   - username: for workers, who often have no email account (or no
--     interest in managing one). The app mints a synthetic,
--     undeliverable address for these (`<username>@workers.machla.internal`)
--     so Supabase Auth — which is email-native — still has something to
--     key the account on; the person only ever sees/types their
--     username. This mirrors the established pattern in
--     lib/auth/demoAccount.ts (`demo-account@machla.internal`), the one
--     other place this codebase already uses a `*.machla.internal`
--     address as a nobody-reads-this-inbox identifier.
--
-- is_synthetic_email marks which is which, so the UI never shows a
-- worker's internal placeholder address as if it were a real inbox, and
-- never offers "forgot password" (there is no inbox to email) for one.
--
-- account_completed_at is null until this step happens — the app-side
-- signal for "still show this account the 'complete your account'
-- reminder", independent of when the account was originally created.

alter table public.users
  add column if not exists email text,
  add column if not exists username text,
  add column if not exists is_synthetic_email boolean not null default false,
  add column if not exists account_completed_at timestamptz;

comment on column public.users.email is
  'Real address (owners/members) or a synthetic '
  '<username>@workers.machla.internal placeholder (see is_synthetic_email). '
  'Mirrors auth.users.email once set. Nullable: existing phone+OTP '
  'accounts have neither until they complete account setup.';
comment on column public.users.username is
  'Set only for accounts that chose a username instead of a real email '
  '(typically workers). Resolves to email at login time. Nullable.';
comment on column public.users.is_synthetic_email is
  'true when email is an internally-generated placeholder, not a real '
  'inbox — never send anything there, never show it as-is in the UI.';
comment on column public.users.account_completed_at is
  'When this account added an email/username + password alongside its '
  'original phone+OTP sign-in. Null means the completion reminder should '
  'still show. Not the same as account creation time.';

-- Case-insensitive uniqueness: Postgres UNIQUE is case-sensitive by
-- default, and "Fatima@x.com"/"fatima@x.com" must not both exist. Partial
-- (where not null) so the many existing rows with neither set don't
-- collide with each other.
create unique index if not exists users_email_lower_unique_idx
  on public.users (lower(email)) where email is not null;
create unique index if not exists users_username_lower_unique_idx
  on public.users (lower(username)) where username is not null;
