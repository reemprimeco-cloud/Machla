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

## 4. Phase 2 implementation status

`/welcome` and the root `/` redirect are implemented as of Phase 2
(`15-localization-architecture.md`). Current behavior, ahead of Phase 3
auth:

- `/` is a server component that checks only for the locale cookie: no
  cookie → `redirect("/welcome")`; cookie present → renders a placeholder
  `HomeShell` (not yet the real dashboard). Once Phase 3/4 land, this
  redirect gains the real auth + household-membership checks described
  in §1 above, and `/` starts routing into `(worker)`/`(household)`
  instead of `HomeShell`.
- `/login`, `/login/verify`, `/onboarding`, `/join/[code]`,
  `/household/new`, and everything under `(worker)`/`(household)` are
  still unbuilt — Phase 3 onward.
- `HomeShell` carries a "Change language" link back to `/welcome`, so a
  language already chosen can always be revisited — `/welcome` does not
  become unreachable once a locale cookie exists.

## 5. Mapping to the two future native apps

`(worker)` and `(household)` are already isolated route groups sharing no
screens — this maps directly onto the future `HomeList Worker` and
`HomeList Home` Expo apps (`12-future-apps-architecture.md`): each native
app would essentially "keep" one route group's screens and drop the
other, while both continue to call the same Supabase backend/RPCs.
