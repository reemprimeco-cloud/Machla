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
