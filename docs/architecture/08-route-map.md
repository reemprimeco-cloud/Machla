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

## 4. Implementation status (Phase 2 + 3)

- `/` is a server component with two sequential gates: no locale cookie
  → `redirect("/welcome")` (Phase 2); locale set but no session →
  `redirect("/login")` (Phase 3); both pass → renders a placeholder
  `HomeShell` (still not the real dashboard — that's Phase 4's household-
  membership check, per §1 above).
- `/login` and `/login/verify` are built (`06-auth-otp-flow.md` §7).
  `/onboarding`, `/join/[code]`, `/household/new`, and everything under
  `(worker)`/`(household)` are still unbuilt — Phase 4 onward.
- `HomeShell` carries a "Change language" link back to `/welcome` and a
  working "Log out" button — a language already chosen, or a session
  already established, can always be revisited/exited; neither `/welcome`
  nor `/login` become unreachable once their respective state exists.
- Session refresh is handled by `proxy.ts` (Next.js 16 renamed
  `middleware.ts` — see `06-auth-otp-flow.md` §7), not by any individual
  route.

## 5. Mapping to the two future native apps

`(worker)` and `(household)` are already isolated route groups sharing no
screens — this maps directly onto the future `HomeList Worker` and
`HomeList Home` Expo apps (`12-future-apps-architecture.md`): each native
app would essentially "keep" one route group's screens and drop the
other, while both continue to call the same Supabase backend/RPCs.
