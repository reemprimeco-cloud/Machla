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
  /home                        — Homes switcher: every household the user
                                   belongs to, as a card (superseded
                                   /switch-household, below — see §4)
  /home/dashboard               — the currently-selected household: new/recent lists
  /home/lists                  — all lists (currently-selected household)
  /home/lists/[listId]         — grouped list + purchase checklist + progress
  /home/members                — member/worker management (Owner sees manage
                                   actions; Member sees read-only)
  /home/invitations             — active invitations (Owner-only; Member gets
                                   redirected/403 server-side too, not just hidden)
  /home/settings                — ACCOUNT-level: profile, language, logout —
                                   not household-level (superseded an earlier
                                   plan for this path, see §4)
  /home/shop                    — owner/member's OWN list — mirrors
                                   /worker/* exactly (basePath-scoped reuse
                                   of the same components), for things they
                                   want to buy themselves, not through a
                                   helper. See §4.2.
  /home/shop/c/[key]
  /home/shop/search
  /home/shop/list
  /home/shop/photo
  /home/shop/sent/[id]
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

## 4. Implementation status (Phases 2-9)

`/` is now pure routing with no UI of its own, gating in order: no locale
cookie → `/welcome`; no session → `/login`; no household → `/onboarding`;
otherwise → `/worker` for a Worker, `/home` for an Owner/Member.

### 4.1 The Homes switcher (supersedes the reserved `/switch-household`)

Item 5 in `14-technical-risks-decisions.md` deferred a household switcher
as a V1 edge case not worth building — every user, in practice, would
have exactly one household. That stopped holding once "My home" and "My
office" as separate households, each with its own helper, became a real
request rather than a hypothetical multi-membership edge case, so this
reverses that call rather than special-casing around it.

`/home` is now the switcher itself (not a separate `/switch-household`,
which is no longer reserved) — every household the caller is an
owner/member of, as a card, always shown rather than only when there
happens to be more than one. `lib/household/currentHousehold.ts` stores
which one is "current" in a cookie, the same device-preference pattern
`lib/i18n/cookie.ts` already uses for locale; `requireHouseholdAccess()`
resolves it (falling back to the first membership if the cookie is
unset, stale, or forged — it is never itself an authorization check, see
the function's own doc comment). What used to render at `/home` moved to
`/home/dashboard` unchanged.

### 4.2 The owner/member's own list (`/home/shop/*`)

`04-roles-permission-matrix.md` already listed "Create/build a shopping
list (draft)" as ✅ for Owner and Member, not just Worker — the RPCs
(`get_or_create_draft_list`, `set_list_item`, `send_list`, ...,
`20260809170000_phase6_worker_lists.sql`) check `is_active_member`, no
role restriction, and say so directly in their own comments. The
permission existed from Phase 6; only the UI to use it as an owner/member
didn't.

Rather than a second implementation, `app/home/shop/*` is a thin
`basePath`-parameterized reuse of every `app/worker/*` screen and
component: `WorkerHome`, `CategoryGrid`, `CategoryBrowser`,
`SearchResults`, `ListReview`, `PhotoCapture`, `SentConfirmation`, and
`WorkerBar`/`SearchBox` all take an optional `basePath` (default
`/worker`) that the shop variant sets to `/home/shop`, changing only
where their internal links point. `isWorker` (literally
`basePath === "/worker"`) hides the two pieces of chrome that would be
redundant in the shop variant — the "My lists" link (a sent list here
already appears in `/home/lists` alongside a helper's, since
`get_household_lists` never filtered by who sent it) and the inline
account actions (redundant with the Settings tab, §4.1).

No new SQL, no new authorization rule — `getDraftList`/`getListById`
already key on `created_by_user_id = auth.uid()`, so the owner's own
draft is already a separate row from a helper's in the same household.
Reached from a "My own list" card on `/home/dashboard`.

A persistent bottom tab bar (`components/household/HomeTabBar.tsx`,
mounted by `app/home/layout.tsx`) replaces the per-screen "back" links
across this whole route group: Homes, Notifications, Settings — visible
on every `/home/*` page. `/notifications` is shared with the worker
experience and sits outside this layout, so `NotificationsScreen`
mounts the same bar itself for a household caller rather than via layout
nesting.

One correctness pitfall worth recording: `app/home/layout.tsx` calls
`requireHouseholdAccess()` itself, redirecting on the same conditions
every page under it already re-checks. That looks redundant —
`getServerUserProfile`/`getActiveMemberships` are `cache()`'d, so the
second call costs nothing — but it is not decorative. A layout with no
awaited work of its own starts streaming its shell to the client
immediately; a `redirect()` thrown later by a child page then arrives as
a 200 response carrying a client-side refresh instruction instead of a
real HTTP 307. Confirmed by curling an unauthenticated `/home/lists`
before this fix (200) and after (307) — the layout being `async` and
awaiting the guard before rendering anything is what restores the real
status code for every route underneath it.

Built as of Phase 9:

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
/worker/lists            the worker's own sent-list history [Phase 8]
/notifications           inbox + per-type switches          [Phase 8]
/offline                 shown by the service worker        [Phase 9]
```

Phase 9 added the file-convention states around these: `app/error.tsx`
(segment error boundary), `app/not-found.tsx`, and `loading.tsx` under
`/worker`, `/worker/list`, `/worker/lists`, `/home` and `/notifications`.

Two Next.js 16 details worth recording, both checked against the bundled
docs rather than assumed:

- the error boundary receives **`retry`**, not the `reset` earlier versions
  passed (`reset` still exists but the docs steer away from it);
- a directory whose name starts with `_` is a **private folder** and is not
  routed at all — an ephemeral `app/__preview` page during the Phase 9
  audit silently 404'd because of it.

`/notifications` is shared by both experiences — RLS scopes the rows to
the caller, so no role check is needed to keep the two inboxes apart. It
marks everything read on open: the act of looking is the acknowledgement,
which is one fewer thing to tap for a user who may not read the label on a
"mark as read" button.

`/worker/c/[key]` is keyed on `categories.key`, not the uuid, so the URL
survives a catalogue re-import. `/worker/sent/[id]` reads the list by id
but filters on `created_by_user_id` on top of RLS, so it cannot be used to
view someone else's list.

Opening `/home/lists/[id]` marks the list viewed as a side effect —
best-effort, and the RPC only ever moves `sent → viewed`, so re-opening a
completed list cannot walk its status backwards.

Still unbuilt: `/worker/profile` (the worker experience still uses
`AccountActions` inline rather than its own settings screen — see §4.1
for why the household side moved to a dedicated one).

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
