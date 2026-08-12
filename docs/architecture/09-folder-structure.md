# 09 — Recommended Folder Structure

## 1. V1 reality vs. future shape

Master plan Section 23 shows a `/apps` + `/packages` monorepo layout but
is explicit: **"For V1, do NOT physically build three applications. Build
one responsive PWA."** Standing up a full monorepo (Turborepo/pnpm
workspaces, multiple `package.json`s) for a single app would violate rule
29.3 ("do not introduce unnecessary dependencies"). The approach is a
**single Next.js app with internal module boundaries that mirror the
future package split**, so extraction into a real monorepo later is a
mechanical move, not a redesign.

### The app lives at the repository root — a reversal, and why

Phases 1–13 placed it at `apps/web/`, anticipating sibling `apps/`. That
directory was moved to the repository root after it caused the only
deployment failure this project has had, twice over: Vercel's default
import looks for a `package.json` at the repository root, found none,
detected no framework, ran **no build at all**, and published an empty
directory. The symptom was a live URL returning `404: NOT_FOUND`, which
reads like an application bug and is not one
(`17-deployment.md` §2.1).

The fix could have been a settings change — Root Directory → `apps/web` —
and that is what was tried first. It was rejected as the permanent answer
because it puts a load-bearing, invisible requirement in a dashboard
rather than in the repository: nothing in a clean checkout tells you the
deploy will silently publish nothing without it, and no test can catch
it.

**What this costs.** The layout no longer visually anticipates
`apps/mobile`. That cost is small and recoverable: `12-future-apps-architecture.md`
§6 lists the modules that would be extracted into `packages/`, and that
list is unchanged by where the web app sits. A native client consumes the
Supabase API (`18-backend-contract.md`), not this directory tree, and
will almost certainly live in its own repository.

**What it buys.** Deployment has no configuration to get wrong. Vercel's
zero-config Next.js detection applies, which is its most heavily
travelled path.

## 2. Proposed Phase 1 layout

```text
/ (repo root)                    ← the Next.js app IS the repo root
├── app/
│   ├── (public)  welcome, login, login/verify
│   ├── (onboarding)  onboarding, join/[code], household/new
│   ├── (worker)  worker/...  including worker/photo
│   ├── (household)  home/...
│   └── layout.tsx, globals.css
├── components/                  ← candidate for a future packages/ui
├── lib/
│   ├── supabase/                ← typed client, server/client helpers
│   ├── i18n/  auth/  household/  catalog/  list/
├── locales/                     ← 9 language files, parity-checked
├── public/                      ← flags, PWA icons
├── proxy.ts                     ← Next.js 16's renamed middleware
├── package.json  next.config.ts  tsconfig.json
│
├── HomeList_Claude_Code_Master_Plan.md
├── docs/architecture/           ← this document set
├── supabase/
│   ├── migrations/              ← schema, RLS, every write RPC
│   └── tests/                   ← 295 assertions, run as `authenticated`
└── catalog-import/              ← reference data + importer, NOT part of
                                   the running app; holds the only use of
                                   the service role key
```

### As-built, Phases 1-4 (deviations from the proposal above)

- No `tailwind.config.ts` — Tailwind v4 (what `create-next-app` scaffolded)
  is configured via `@theme` blocks directly in `app/globals.css`, not a
  JS/TS config file. Not an architectural change, just the current
  tool version's convention.
- `lib/i18n/` (config, messages, cookie, `LocaleProvider.tsx`)
  and `scripts/check-locales.mjs` were added in Phase 2 — see
  `15-localization-architecture.md`.
- `lib/auth/` (`session.ts`, `phone.ts`,
  `syncPreferredLanguage.ts`) and `lib/supabase/{updateSession,
  isConfigured}.ts` were added in Phase 3 — see `06-auth-otp-flow.md` §7.
  `proxy.ts` lives at `` root (Next.js 16's file-convention
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
  service-role key exists anywhere in the repository root. Every Supabase-calling
  code path also checks `lib/supabase/isConfigured.ts` first, so the app
  degrades gracefully (treats the visitor as signed-out) rather than
  crashing while no project is provisioned — see `06-auth-otp-flow.md` §7.
- Phase 4 added `lib/household/` (`queries.ts`, `actions.ts`,
  `guard.ts`, `errors.ts`), `components/household/`,
  `components/ui/Primitives.tsx`, and the `app/onboarding`,
  `app/household/new`, `app/join`, `app/join/[code]`, `app/home*`, and
  `app/worker` routes. Mutations are Next.js Server Actions
  (`lib/household/actions.ts`) that call the Postgres RPCs — the actions
  perform no authorization of their own, deliberately, since a Server
  Action is reachable as a plain POST and the database check is the one
  that holds either way.
- `supabase/tests/` (Phase 4) holds the SQL test suite and its harness —
  see `supabase/tests/README.md`. It is the primary verification for
  anything authorization-shaped, because that logic lives in Postgres
  rather than in the repository root.
- `catalog-import/` (Phase 5) holds the offline catalogue pipeline:
  `data/` (categories, product types, products — the curated source of
  truth), `images/` (licensed photography, gitignored — the repository
  holds the pipeline, not the assets), and `scripts/`
  (`build-catalog.mjs` validates and assembles, `import.mjs` upserts into
  Supabase, `upload-images.mjs` pushes photographs to Storage). It is deliberately **not** part of
  the repository root: refreshing the catalogue must never require a UI change or a
  redeploy, and this is the only code that touches the service role key.
  `build-catalog.mjs` has no dependencies at all, so validation and
  `--dry-run` work in a clean checkout — see
  `11-product-catalog-architecture.md` §7.

the repository root is used (rather than a bare repo-root Next.js app) even in V1
so that `/apps/worker-app` and `/apps/household-app` can be added
side-by-side later without moving the existing app — this one nesting
decision is what keeps the "monorepo-ready" promise cheap.

## 3. What moves to `/packages` later (Phase 12+, not now)

| `...` today | becomes `/packages/...` when a second client exists |
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
functions rather than the repository root code wherever practical (see
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
