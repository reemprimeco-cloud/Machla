# 08 — Application Route Map

## 1. Localization is not URL-based

Language is a **user/session preference**, not a URL segment (no
`/ar/...`, `/hi/...` prefixes). Rationale: the target user often can't
read well enough to recognize a language code in a URL, invitation links
must stay short and identical regardless of who opens them, and per-user
language is already a `users.preferred_language` column plus a pre-auth
cookie. This is a Phase 0 decision — see `14-technical-risks-decisions.md`
if a URL-based i18n routing strategy (e.g. for SEO on a future public
landing page) is wanted later.

## 2. Route groups (Next.js App Router)

```text
/                              → redirect based on auth + membership state

(public)                       — no auth required
  /welcome                     — language picker (first screen)
  /login                       — phone number entry
  /login/verify                — OTP entry

(onboarding)                   — auth required, no active household yet
  /onboarding                  — "I have an invite" vs "Create a household"
  /join/[code]                 — invitation preview + confirm (from a shared link)
  /household/new               — create household form (→ becomes Owner)

(worker)                       — auth required, active household_members.role='worker'
  /worker                      — home: category grid ("What do you need?")
  /worker/category/[categoryId]
  /worker/product/[productId]
  /worker/list                 — current draft list (review, quantities)
  /worker/list/sent            — send confirmation
  /worker/history              — past sent lists (read-only)
  /worker/profile              — language, logout

(household)                    — auth required, active role='owner'|'member'
  /home                        — dashboard: new/recent lists
  /home/lists                  — all lists
  /home/lists/[listId]         — grouped list + purchase checklist + progress
  /home/members                — member/worker management (Owner sees manage
                                   actions; Member sees read-only)
  /home/invitations             — active invitations (Owner-only; Member gets
                                   redirected/403 server-side too, not just hidden)
  /home/settings                — household name, display language (Owner-only)
  /home/profile                 — own language, logout

(shared)
  /switch-household             — only rendered if the signed-in user has
                                    >1 active household_members row (edge
                                    case the schema allows; see
                                    05-household-model.md §2 item 5)
  /logout
```

## 3. Server-side guarding, not just hidden UI

Every `(worker)` and `(household)` route reads the caller's
`household_members` row(s) server-side (Next.js server component /
middleware calling Supabase with the user's session) before rendering —
a Worker requesting `/home/settings` gets redirected/blocked at the
server, not just a hidden nav link. This mirrors the master plan's
explicit rule: "Never rely only on frontend route protection" (Section
15). The actual data access is additionally protected by RLS regardless
of what the route layer does, so this is defense-in-depth, not the
primary control.

## 4. Implementation status (Phases 2-7)

`/` is now pure routing with no UI of its own, gating in order: no locale
cookie → `/welcome`; no session → `/login`; no household → `/onboarding`;
otherwise → `/worker` for a Worker, `/home` for an Owner/Member.

Built as of Phase 7:

```text
/welcome                 language picker                    [Phase 2]
/login, /login/verify    phone + OTP                        [Phase 3]
/onboarding              join-vs-create fork                [Phase 4]
/household/new           create a household (become Owner)  [Phase 4]
/join                    manual invitation-code entry       [Phase 4]
/join/[code]             invitation deep link               [Phase 4]
/home                    household dashboard                [Phase 4]
/home/members            roster + remove (Owner acts)       [Phase 4]
/home/invitations        create / share / revoke (Owner)    [Phase 4]
/worker                  categories, search, frequent       [Phase 6]
/worker/c/[key]          products in one category           [Phase 6]
/worker/search           cross-language product search      [Phase 6]
/worker/list             review + send the draft            [Phase 6]
/worker/sent/[id]        send confirmation                  [Phase 6]
/home/lists              received lists, newest first       [Phase 7]
/home/lists/[id]         the checklist the household shops  [Phase 7]
```

`/worker/c/[key]` is keyed on `categories.key`, not the uuid, so the URL
survives a catalogue re-import. `/worker/sent/[id]` reads the list by id
but filters on `created_by_user_id` on top of RLS, so it cannot be used to
view someone else's list.

Opening `/home/lists/[id]` marks the list viewed as a side effect —
best-effort, and the RPC only ever moves `sent → viewed`, so re-opening a
completed list cannot walk its status backwards.

Still unbuilt: `/home/settings`, `/home/profile`, `/worker/profile`, and
`/switch-household`.

Notes on the guards themselves:

- `lib/household/guard.ts` centralizes them: `requireHouseholdAccess()`,
  `requireOwner()`, `requireWorkerAccess()`. Each redirects rather than
  erroring, so a Worker who opens `/home/invitations` lands somewhere
  useful instead of on a 403.
- These are **defense in depth, not the boundary**. Every route they
  guard is also protected by RLS and by the RPCs' own `auth.uid()`
  checks, so bypassing the route layer changes nothing —
  `10-security-model.md` §5A.
- The `/join/[code]` deep link forwards an unauthenticated visitor to
  `/login?next=/join/<code>` and returns them afterwards.
  `lib/auth/nextPath.ts` restricts that parameter to same-site absolute
  paths, so it can't be used as an open redirect.
- Session refresh is handled by `proxy.ts` (Next.js 16 renamed
  `middleware.ts` — see `06-auth-otp-flow.md` §7), not by any individual
  route.

## 5. Mapping to the two future native apps

`(worker)` and `(household)` are already isolated route groups sharing no
screens — this maps directly onto the future `HomeList Worker` and
`HomeList Home` Expo apps (`12-future-apps-architecture.md`): each native
app would essentially "keep" one route group's screens and drop the
other, while both continue to call the same Supabase backend/RPCs.
