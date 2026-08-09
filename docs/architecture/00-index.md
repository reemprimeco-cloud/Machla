# HomeList — Phase 0 Architecture Documentation

Status: **Phase 0 (architecture) approved. Phase 1 (project setup),
Phase 2 (localization system), and Phase 3 (authentication) implemented.**
Scope and rules are defined by `/HomeList_Claude_Code_Master_Plan.md` at
the repo root — read that first. Documents 1–14 are the original Phase 0
deliverables (product architecture, DB ERD, schema proposal, permission
matrix, household/member/worker relationship model, auth/OTP flow,
invitation/linking flow, route map, folder structure, security model,
product catalog/import architecture, future two-app architecture, and
technical risks/decisions). Document 15 was added in Phase 2; document 6
(`06-auth-otp-flow.md`) gained a Phase 3 implementation-status section.

The application code lives in `apps/web` (Next.js/TypeScript/Tailwind) and
`supabase/migrations` — see those directories for what's actually been
built. This folder stays the architectural reference those phases
implement against. `docs/design/` holds the HomeList UI Kit's brand sheet
and integration notes (see `15-localization-architecture.md` §9).

## Documents

| # | Document | Covers |
|---|---|---|
| 1 | [01-product-architecture.md](./01-product-architecture.md) | System overview, personas, high-level architecture diagram, design principles |
| 2 | [02-database-erd.md](./02-database-erd.md) | Entity-relationship diagram (Mermaid) and entity summary |
| 3 | [03-database-schema.md](./03-database-schema.md) | Full table-by-table schema proposal (columns, types, constraints, indexes) |
| 4 | [04-roles-permission-matrix.md](./04-roles-permission-matrix.md) | Roles, the two-role-fields decision, full permission matrix |
| 5 | [05-household-model.md](./05-household-model.md) | Household/member/worker relationship model, lifecycle, multi-membership |
| 6 | [06-auth-otp-flow.md](./06-auth-otp-flow.md) | Phone + OTP authentication flow, session/identity model |
| 7 | [07-invitation-flow.md](./07-invitation-flow.md) | Invitation generation, code/link design, redemption flow, revocation |
| 8 | [08-route-map.md](./08-route-map.md) | Application route map for the single V1 PWA (worker + household experiences) |
| 9 | [09-folder-structure.md](./09-folder-structure.md) | Recommended repository/folder structure, monorepo-readiness |
| 10 | [10-security-model.md](./10-security-model.md) | RLS strategy, RPC-boundary strategy, threat scenarios, isolation guarantees |
| 11 | [11-product-catalog-architecture.md](./11-product-catalog-architecture.md) | Catalog data model, import pipeline, Sharq/Deliveroo reference-source policy |
| 12 | [12-future-apps-architecture.md](./12-future-apps-architecture.md) | Future HomeList Worker / HomeList Home native apps sharing one backend |
| 13 | [13-shopping-list-grouping-checklist.md](./13-shopping-list-grouping-checklist.md) | Category grouping + purchase checklist architecture (core V1 requirement) |
| 14 | [14-technical-risks-decisions.md](./14-technical-risks-decisions.md) | Open decisions requiring approval, risks, and rationale for each |
| 15 | [15-localization-architecture.md](./15-localization-architecture.md) | Phase 2: language-selection UI, cookie persistence, RTL/LTR implementation, fallback behavior |

## How to read this set

Start with `01-product-architecture.md` for the big picture, then
`02`/`03` for data, `04`/`05` for roles and household structure, `06`/`07`
for identity and linking, `08`/`09` for how the codebase will be laid out,
`10` for how it's kept secure, `11` for the catalog, `12` for the future
native apps, `13` for the shopping-list grouping/checklist requirement,
`14` for every decision made on your behalf that needed explicit approval,
and `15` for how Phase 2 implemented localization on top of the Phase 1
foundation.
