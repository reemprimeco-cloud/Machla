# 06 — Authentication & OTP Flow

## 1. Provider decision

**Supabase Auth, phone + OTP (SMS), is the V1 authentication provider.**
This satisfies master plan rule 29.13 ("never store OTP codes manually
unless required by the provider") for free — Supabase Auth owns OTP
generation, delivery, expiry, and verification internally; the application
schema never has an `otp_codes` table.

An SMS delivery sub-provider (Twilio, MessageBird, Vonage, etc.) must
still be configured in the Supabase project for Kuwait-number
deliverability — this is a Phase 3 setup task and an open decision, see
`14-technical-risks-decisions.md` item 10.

## 2. Identity model

- `auth.users` (Supabase-managed) is the source of truth for
  "does this phone number have a valid session."
- `public.users` (application-managed, see `03-database-schema.md`) is a
  1:1 profile row, `id = auth.users.id`, created by a `handle_new_user`
  trigger on first successful OTP verification.
- Every RLS policy and RPC function authorizes against `auth.uid()`,
  never a client-supplied user id.

## 3. Flow

```text
┌─────────────┐
│ /welcome     │  Pick a language (pre-auth; stored in a cookie so the
└──────┬───────┘  OTP screens themselves can render in that language)
       ▼
┌─────────────┐
│ /login       │  Enter phone number (+country code, default +965)
└──────┬───────┘  → supabase.auth.signInWithOtp({ phone })
       ▼
┌─────────────┐
│ /login/verify│  Enter 6-digit code
└──────┬───────┘  → supabase.auth.verifyOtp({ phone, token, type: 'sms' })
       ▼
   Session established (JWT in Supabase client storage)
       │
       ▼
 First login? ── yes ──▶ handle_new_user trigger inserts public.users row
       │                  (role=NULL persona pending, preferred_language
       │                  from the pre-auth cookie) → onboarding
       │
       no
       │
       ▼
 Does this user have ≥1 active household_members row?
       │
   ┌───┴────┐
   no        yes
   │          │
   ▼          ▼
/onboarding  route to that household's Worker or Household
(pick: "I    experience per household_members.role (if >1 active
have an      membership, see decision item 5 in
invite" vs   14-technical-risks-decisions.md for the V1 stance)
"Create a
household")
```

## 4. Session handling

- Supabase client-side SDK manages session refresh; the app does not
  implement its own token logic.
- Logout calls `supabase.auth.signOut()` and clears any locally-cached
  preferred-language cookie back to "unset" only if the user explicitly
  wants to change device-level language before their next login — normal
  logout keeps the language preference (it's a `users` column, tied to the
  account, not the device).
- No "remember me" / long-lived alternate credential is introduced —
  session lifetime follows Supabase Auth defaults.

## 5. Role handling at signup

`users.role` (the primary-persona field, see
`04-roles-permission-matrix.md` §1) is set once, at the end of
onboarding, based on which path the user took:

- Created a household → `role = 'owner'`
- Accepted an invitation with `invitation.role = 'member'` → `role =
  'member'`
- Accepted an invitation with `invitation.role = 'worker'` → `role =
  'worker'`

This value is **never** used to authorize household actions (that's
`household_members.role`); it only decides the default UI/language-set on
subsequent logins and which persona-specific onboarding copy to show if
the user later joins an additional household with a different role.

## 6. Explicit non-goals for V1 auth

- No email/password option.
- No social login.
- No admin impersonation UI (any admin/support access to fix data goes
  through Supabase Studio with the service role, outside the app).
- No biometric/passkey layer (candidate for native apps later).
