# 09 — Recommended Folder Structure

## 1. V1 reality vs. future shape

Master plan Section 23 shows a `/apps` + `/packages` monorepo layout but
is explicit: **"For V1, do NOT physically build three applications. Build
one responsive PWA."** Standing up a full monorepo (Turborepo/pnpm
workspaces, multiple `package.json`s) in Phase 1 for a single app would
violate rule 29.3 ("do not introduce unnecessary dependencies"). Phase 0
recommends a **single Next.js app with internal module boundaries that
mirror the future package split**, so extraction into a real monorepo
later (Phase 12, when native apps actually start) is a mechanical move,
not a redesign. Flagged as a decision in
`14-technical-risks-decisions.md` item — confirm this staged approach is
acceptable before Phase 1.

## 2. Proposed Phase 1 layout

```text
/ (repo root)
├── HomeList_Claude_Code_Master_Plan.md
├── docs/
│   └── architecture/            ← this Phase 0 deliverable set
├── supabase/
│   ├── migrations/              ← SQL migrations (Phase 1+)
│   └── seed/                    ← category seed data, later product import (Phase 5)
├── catalog-import/              ← curated CSV/JSON reference data + import
│   │                              script (Phase 5) — NOT part of the running app
│   └── scripts/
└── apps/
    └── web/                     ← the single Next.js PWA
        ├── app/
        │   ├── (public)/welcome, login, login/verify
        │   ├── (onboarding)/onboarding, join/[code], household/new
        │   ├── (worker)/worker/...
        │   ├── (household)/home/...
        │   └── layout.tsx, globals.css
        ├── components/          ← UI components (candidate for future /packages/ui)
        ├── lib/
        │   ├── supabase/        ← typed client, server/client helpers
        │   ├── auth/            ← session helpers (candidate for /packages/auth)
        │   ├── household/       ← household/invitation client calls
        │   ├── catalog/         ← product/category client calls (candidate
        │   │                       for /packages/catalog)
        │   └── lists/           ← shopping-list + purchase-checklist client calls
        ├── locales/             ← UI strings only: ar.json, en.json, hi.json,
        │                            te.json, ur.json, fil.json, ne.json,
        │                            id.json, si.json (candidate for /packages/i18n)
        ├── types/                ← generated Supabase types + shared app types
        │                            (candidate for /packages/types)
        ├── public/               ← icons, manifest.json (PWA)
        ├── next.config.ts
        ├── tailwind.config.ts
        └── package.json
```

### As-built, Phases 1-4 (deviations from the proposal above)

- No `tailwind.config.ts` — Tailwind v4 (what `create-next-app` scaffolded)
  is configured via `@theme` blocks directly in `app/globals.css`, not a
  JS/TS config file. Not an architectural change, just the current
  tool version's convention.
- `apps/web/lib/i18n/` (config, messages, cookie, `LocaleProvider.tsx`)
  and `apps/web/scripts/check-locales.mjs` were added in Phase 2 — see
  `15-localization-architecture.md`.
- `apps/web/lib/auth/` (`session.ts`, `phone.ts`,
  `syncPreferredLanguage.ts`) and `apps/web/lib/supabase/{updateSession,
  isConfigured}.ts` were added in Phase 3 — see `06-auth-otp-flow.md` §7.
  `proxy.ts` lives at `apps/web/` root (Next.js 16's file-convention
  location, not inside `lib/`). `lib/household`, `lib/catalog`,
  `lib/lists` remain unbuilt, added in the phases that implement each
  (4/5/6-8 respectively).
- `app/welcome/page.tsx` (language picker, Phase 2) and
  `app/login/page.tsx` + `app/login/verify/page.tsx` (Phase 3) exist;
  `components/HomeShell.tsx` + `components/ServiceWorkerRegistration.tsx`
  + `components/brand/HomeListIcon.tsx` support them. The full
  `(onboarding)/(worker)/(household)` route-group structure is still
  Phase 4+.
- `lib/supabase/database.types.ts` is hand-authored against the Phase 1
  migration (no live Supabase project to codegen from yet) —
  `10-security-model.md` §6 and `03-database-schema.md` cover why no
  service-role key exists anywhere in `apps/web`. Every Supabase-calling
  code path also checks `lib/supabase/isConfigured.ts` first, so the app
  degrades gracefully (treats the visitor as signed-out) rather than
  crashing while no project is provisioned — see `06-auth-otp-flow.md` §7.
- Phase 4 added `apps/web/lib/household/` (`queries.ts`, `actions.ts`,
  `guard.ts`, `errors.ts`), `apps/web/components/household/`,
  `apps/web/components/ui/Primitives.tsx`, and the `app/onboarding`,
  `app/household/new`, `app/join`, `app/join/[code]`, `app/home*`, and
  `app/worker` routes. Mutations are Next.js Server Actions
  (`lib/household/actions.ts`) that call the Postgres RPCs — the actions
  perform no authorization of their own, deliberately, since a Server
  Action is reachable as a plain POST and the database check is the one
  that holds either way.
- `supabase/tests/` (Phase 4) holds the SQL test suite and its harness —
  see `supabase/tests/README.md`. It is the primary verification for
  anything authorization-shaped, because that logic lives in Postgres
  rather than in `apps/web`.
- `catalog-import/` does not exist yet (Phase 5).

`apps/web` is used (rather than a bare repo-root Next.js app) even in V1
so that `/apps/worker-app` and `/apps/household-app` can be added
side-by-side later without moving the existing app — this one nesting
decision is what keeps the "monorepo-ready" promise cheap.

## 3. What moves to `/packages` later (Phase 12+, not now)

| `apps/web/...` today | becomes `/packages/...` when a second client exists |
|---|---|
| `lib/supabase`, `types/` | `packages/database` (typed client + generated types) |
| `lib/auth` | `packages/auth` |
| `lib/catalog` | `packages/catalog` |
| `locales/` | `packages/i18n` |
| `components/` (the presentational, non-Next-specific ones) | `packages/ui` |
| shared app types | `packages/types` |

Business logic that must be identical across web and future native
clients (invitation redemption rules, purchase-status write rules,
category-grouping/order logic) is **already** pushed into Postgres RPC
functions rather than `apps/web` code wherever practical (see
`10-security-model.md`), which is a stronger and earlier form of this
same "share, don't duplicate" goal — the client-side `lib/` modules are
thin wrappers around those RPCs, not where the rules live.

## 4. Non-goals for Phase 1 folder setup

- No Turborepo/Nx/pnpm-workspace config yet.
- No `apps/worker-app` or `apps/household-app` directories created yet
  (they're documented here as the target, not scaffolded).
- No premature `packages/*` split — introducing multi-package tooling
  before there's a second consumer adds build complexity for zero benefit
  today.
