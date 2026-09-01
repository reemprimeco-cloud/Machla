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

## 5A. Dashboard settings this code depends on

Supabase's Phone provider panel carries two settings the application is
coupled to. Neither coupling is visible from the dashboard, and getting
either wrong produces a broken login rather than an error message.

- **SMS OTP Length must be 6.** `app/login/verify/page.tsx` strips
  non-digits and caps input at 6 (`.slice(0, 6)`), and its Verify button
  stays disabled until `code.length === 6`. Set the provider to 7 or 8
  and the user can type a code but can never submit it. Changing this
  setting means changing both of those numbers.

- **SMS OTP Expiry should be raised from the 60-second default.** Sixty
  seconds is short for this app's users specifically: shared phones,
  switching out to the SMS app and back, and typing a code in a script
  that may not be the keyboard's default. Five minutes (300) is the
  recommendation. Supabase's own security advisor complains above one
  hour, so there is plenty of room below that.

The resend control enforces a **60-second cooldown** client-side
(`RESEND_COOLDOWN_SECONDS`), showing a live countdown in the user's
language. This mirrors the interval Supabase Auth enforces server-side
anyway; without the countdown the button appears broken during that
window and gets tapped repeatedly, and **every tap is a paid SMS**. The
countdown digits are wrapped in `<bdi dir="ltr">` so they do not reorder
inside Arabic and Urdu.

Rate limits themselves live in Authentication → Rate Limits, not in the
provider panel, and are worth setting before launch for the same reason:
the cost of the login path is per message sent.

**A Twilio trial account cannot power this flow at all** (verified
against twilio.com/docs/usage/trials): trials send only to five manually
verified numbers (error 21608), only within the sign-up country, and only
using Twilio's pre-defined templates — custom bodies like an OTP are not
supported, so verifying a test number is not a workaround. Alphanumeric
sender IDs are likewise paid-only. Kept here because the failure mode
looks exactly like a configuration mistake.

(The first real send failure on this project was initially attributed to
this; the account turned out to be active, so the actual cause lay in the
paid-account checklist below.)

On an active account, the failure points, in observed order of
likelihood: **Kuwait disabled in Messaging → Geo Permissions** (off by
default for most destinations; error 21408); the **Messaging Service's
sender pool** lacking a sender that can deliver to +965; or a wrong
SID/token pair in Supabase, in which case Twilio's message log shows no
attempt at all. Twilio Console → Monitor → Logs → Messaging carries the
per-attempt error code and is the fastest diagnosis.

**The chosen channel is WhatsApp** (`OTP_CHANNEL` in `lib/auth/phone.ts`;
decision record in `14-technical-risks-decisions.md` item 10). What the
dashboards must have for it to work:

1. Twilio: a WhatsApp **authentication template** in the Content Template
   Builder (an OTP body with a code variable), approved, giving an
   `HX…` Content SID.
2. Supabase → Phone provider: that Content SID in the **"Twilio Content
   SID (For WhatsApp Only)"** field, and a Messaging Service whose sender
   pool includes the WhatsApp sender.
3. The verify step needs nothing: `verifyOtp` keeps `type: "sms"` for
   both channels.

**Test phone numbers** (same panel) map a number to a fixed code and are
documented as skipping the provider entirely — the way to exercise every
flow with no message cost, and the reason development never blocks on
messaging paperwork.

**Incident, 2026-08-31 — Apple Guideline 2.1 rejection, and how it
actually got fixed.** The demo account (`+96590909090` / `123456`)
failed to sign in under review. What followed was a chain of plausible
fixes, each ruled out in turn by a real test against the live project:

1. Suspected the WhatsApp channel doesn't reliably trip Supabase's Test
   OTP bypass the way `'sms'` does (its own docs describe the feature in
   terms of skipping *SMS* delivery specifically). Force-routed the demo
   number through `'sms'`. **Did not fix it** — still "That code didn't
   work" on a follow-up manual test.
2. Suspected `90909090` itself was the problem: it's a real assigned
   Kuwaiti mobile range (5/6/9 are the only prefixes Kuwait carriers
   use), so a missing Test OTP mapping could message an actual stranger.
   Rotated to `+96510101010` (prefix `1`, unassigned in Kuwait's
   numbering plan). **Surfaced new information but did not fix it** —
   sign-in now failed immediately ("something went wrong", no code
   screen reached at all), reading as the phone provider rejecting the
   number's plausibility before ever consulting the Test OTP map.
3. Rotated again, to the owner's own real number (2026-09-01,
   owner-approved) — real and valid, so it can't trip that rejection.
   Fixed the *env var* mismatch that followed (missing leading `+`, and
   later `NEXT_PUBLIC_DEMO_ACCOUNT_PHONE` not matching the Supabase Test
   OTP entry's format) on two more rounds. **Still did not fix it** — a
   real, correctly-addressed WhatsApp message with a genuine random code
   kept arriving instead of the fixed `123456` being accepted. This was
   the point where "keep debugging Twilio/Supabase's Test OTP feature"
   was abandoned as a strategy — three real tests in a row disproved
   three different specific theories about *why* it wasn't firing,
   without ever establishing that it fires at all on this project.

**The actual fix (2026-09-01): stop depending on it.** The demo account
no longer calls `signInWithOtp`/`verifyOtp` with `type: "sms"` at all —
see `lib/auth/demoAccount.ts`. `/login` asks a server action
(`checkDemoAccountAction`) whether the entered number is the demo
account *before* ever sending a real message; if it is, `/login/verify`
calls `demoSignInAction` instead of phone `verifyOtp`, which checks the
code server-side against a fixed value and, on a match, calls
`admin.generateLink({ type: "magiclink", email })` — a Supabase Admin
API method explicitly documented for exactly this ("generates an email
link for a specific action without sending it... build the OTP flow
yourself"). The client then exchanges the returned `hashed_token` for a
real session via `verifyOtp({ token_hash, type: "magiclink" })`. No
Twilio, no WhatsApp, no Test OTP dashboard entry, no message sent
anywhere, ever, for this account. `auth.users.email` /
`email_confirmed_at` were set once on the existing demo user id (a
`demo-account@machla.internal` address nobody reads — it exists only so
`generateLink` resolves to the existing account rather than creating a
new, disconnected one) so this account now has both a phone and an
email identity; `auth.users.phone` and `public.users.phone_number` still
carry the owner's real number from rotation 3 above, so its household
and sample lists carry over unchanged.

The Supabase Test OTP dashboard feature is no longer used or relied on
by this project — it's undocumented here beyond this incident record as
a warning, not a recipe.

**The number itself is intentionally not written in this repository.**
It's set as `DEMO_ACCOUNT_PHONE` (server-only — no `NEXT_PUBLIC_`
prefix, unlike the abandoned channel-forcing attempt, since the check
now happens entirely in `demoAccountActions.ts` server actions and never
needs to reach the browser bundle) in Vercel's Production environment,
precisely because it's a real, owner-identifying phone number and this
repo is public.

**Every other provider should be disabled, Email included.** Supabase
enables Email by default, and it was found enabled on this project when
phone auth was switched on. It is not merely unused — §6 rules it out —
it is an account-creation surface with *no cost barrier*, unlike SMS.

It also had a concrete consequence, measured rather than assumed:

```text
1st email signup  -> succeeded, users.phone_number = ''
2nd email signup  -> FAILED, unique_violation on users.phone_number
```

`handle_new_user` wrote `coalesce(new.phone, '')`, and `phone_number` is
`NOT NULL UNIQUE` — so the empty string is a sentinel exactly one account
can hold, and the second phone-less signup died inside the trigger as an
unexplained 500. `20260810120000_phone_only_identity.sql` now rejects any
phone-less signup outright with `PHONE_REQUIRED`, with the reasoning for
that choice over two alternatives written in the migration itself.

That fix does not make disabling Email optional. It moves the guarantee
into the database, where the rest of this project's guarantees live,
instead of resting on a dashboard toggle someone can flip without seeing
the consequence. Covered by `supabase/tests/08_phone_identity_test.sql`,
whose assertions were confirmed to fail against the old trigger before
being trusted.

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
