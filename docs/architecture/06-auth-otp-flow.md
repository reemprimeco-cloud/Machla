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

## 7. Phase 3 implementation status

Built: `app/login/page.tsx` (phone entry), `app/login/verify/page.tsx`
(OTP entry), `lib/auth/session.ts` (`getServerUserProfile`, wrapped in
React's `cache()` so the root layout and a page can both call it in one
request for one query), `lib/auth/syncPreferredLanguage.ts`, `proxy.ts` +
`lib/supabase/updateSession.ts` (session-refresh — Next.js 16 renamed
`middleware.ts` to `proxy.ts`; same mechanism, see
`node_modules/next/dist/docs/.../file-conventions/proxy.md`).

Not built yet (Phase 4): `/onboarding`, `/join/[code]`,
`/household/new`. Until households exist, a successful login routes to
`/`, which renders the same placeholder `HomeShell` used since Phase 1 —
now showing the signed-in phone number and a working logout button —
instead of the real "does this user have an active household" branch
in §3's diagram.

**Graceful degradation without a live project.** Per
`14-technical-risks-decisions.md` item 10, no Supabase project is
provisioned yet. Every Supabase-calling code path (`updateSession`,
`getServerUserProfile`, `syncPreferredLanguageIfSignedIn`, and each
`/login*` submit handler) checks `lib/supabase/isConfigured.ts` first and
no-ops/shows a translated error rather than throwing — without this, the
root layout's unconditional profile check would 500 on every single page
load, including pre-auth ones, which would have broken the Phase 1
"runs locally" baseline for the whole app rather than just the parts
that actually need a backend. This guard should be removed only if/when
it's no longer needed, not treated as permanent scaffolding.

**`preferred_language` reconciliation** (§4/§5's "which language does a
returning user see") happens in `app/layout.tsx`, server-side, before the
first render: if the signed-in user has a `users.preferred_language` set
and it differs from the device's locale cookie, the DB value wins for
that render. This was deliberately built as a server-side computation
rather than a client-side effect that adjusts state after the fact — the
latter is the more obvious-looking approach but ran into two hooks-lint
rules in practice (`react-hooks/set-state-in-effect` and the refs-during-
render restriction on the "adjust state from a changed prop" pattern);
resolving it server-side sidesteps both and avoids a reconciliation flash
entirely, so it's the better design even ignoring the lint fight.
`components/HomeShell.tsx`'s language picker link and `/login/verify`'s
successful-verification handler both call `router.refresh()` so this
reconciliation runs again immediately after an auth state change,
without waiting for a manual reload.

**Role handling deviates slightly from §5 as currently written:** the
Phase 1 migration's `handle_new_user` trigger leaves `users.role` at its
schema default (`'worker'`) rather than `NULL`/"pending" — the migration
predates this section being written precisely, and changing the column
to nullable for a value nothing reads authoritatively (see
`04-roles-permission-matrix.md` §1) isn't worth a migration on its own.
Phase 4 setting `role` properly at the end of onboarding (household
creation vs. invitation acceptance) will simply overwrite this default;
nothing currently depends on it being `NULL` in the interim.
