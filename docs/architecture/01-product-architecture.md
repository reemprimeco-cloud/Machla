# 01 — Product Architecture

## 1. System overview

HomeList V1 is **one** Next.js PWA with two role-driven experiences —
Worker and Household (Owner/Member) — backed by **one** Supabase project
(Postgres + Auth + Storage). There is no separate backend per experience
and no e-commerce, payment, delivery, WhatsApp, or AI functionality in V1.

```text
                         ┌────────────────────────────┐
                         │        HomeList PWA         │
                         │   (Next.js, TypeScript,     │
                         │    Tailwind, mobile-first)  │
                         │                              │
                         │  ┌────────────┐ ┌──────────┐│
                         │  │  Worker    │ │Household ││
                         │  │  Experience│ │Experience││
                         │  │  (role-    │ │(role-    ││
                         │  │   gated UI)│ │ gated UI)││
                         │  └─────┬──────┘ └────┬─────┘│
                         └────────┼─────────────┼──────┘
                                  │             │
                                  ▼             ▼
                         ┌────────────────────────────┐
                         │         Supabase            │
                         │  ─────────────────────────  │
                         │  Auth (Phone + OTP)          │
                         │  Postgres + Row Level        │
                         │    Security (authorization)  │
                         │  Postgres RPC functions       │
                         │    (invitation redemption,    │
                         │     purchase-status writes)   │
                         │  Storage (owned/licensed       │
                         │    product images)             │
                         └────────────────────────────┘
                                  ▲
                                  │ (Phase 5, offline import script —
                                  │  not part of the running app)
                         ┌────────────────────────────┐
                         │   Catalog Import Pipeline    │
                         │  (curated CSV/JSON → DB)      │
                         └────────────────────────────┘
```

Vercel hosts the Next.js app; Supabase hosts everything stateful. No
Netlify. This mirrors Section 24 of the master plan exactly.

## 2. Personas

| Persona | Who | Primary device | Literacy assumption |
|---|---|---|---|
| **Worker** | Domestic worker, any of 9 supported languages | Low/mid-end Android phone, mobile browser/PWA | May have limited reading ability in English/Arabic; visual-first UI required |
| **Owner** | Household creator/admin | Mobile, sometimes desktop | Reads Arabic or English |
| **Member** | Trusted household adult (spouse, adult child) | Mobile | Reads Arabic or English |

A single Supabase-authenticated identity (`users` row) can, in principle,
be an Owner of one household and a Worker in another (see
`05-household-model.md`). V1 UI does not need to actively support that
edge case, but the data model must not preclude it.

## 3. Design principles (from the master plan, made explicit)

1. **Simplicity > Features.** Every screen in Phase 6/7 must trace back to
   the ideal flow: *Open → See pictures → Tap products → Choose quantity →
   Send* (worker) and *Receive → See grouped list → Buy → Mark done*
   (owner).
2. **Visual clarity > Text.** Category and product selection is
   image-first; text is a label, not the primary affordance.
3. **Security > Convenience.** Every authorization decision is enforced in
   Postgres (RLS + RPC functions), never only in the UI. See
   `10-security-model.md`.
4. **Real Kuwait products > placeholders.** The catalog (Phase 5) is
   curated from real Kuwait grocery references, not generic stock data —
   without importing prices or bypassing anti-bot protections. See
   `11-product-catalog-architecture.md`.
5. **Reusable backend > duplicated systems.** One Supabase schema, one
   auth system, one RLS policy set serve the Worker UI, the Household UI,
   and (later) two native apps. See `12-future-apps-architecture.md`.
6. **Mobile-first > desktop-first.** Layout, touch targets, and
   performance budgets are designed for a single-hand phone session first.

## 4. What Phase 0 explicitly does NOT include

- No Next.js project, no `package.json`, no dependencies installed.
- No Supabase project provisioned, no migrations applied.
- No UI components or styling.
- No product data import (Phase 5).
- No payments, checkout, delivery, WhatsApp, or AI (out of scope for all
  of V1, not just Phase 0).

## 5. How the shopping-list grouping/checklist requirement fits in

The newly-specified category-grouped list and purchase checklist (master
plan Section 16A) is the single most data-model-significant V1 feature
after auth/household/invitations. It is treated as core, not a bolt-on:
`shopping_list_items.category_id` and the purchase-execution columns are
part of the Phase 0 schema proposal (see `03-database-schema.md`), and the
RPC-boundary security pattern in `10-security-model.md` exists specifically
to keep "what the worker requested" and "what the owner did while
shopping" as two independently-writable, independently-protected concepts.
Full behavior spec: `13-shopping-list-grouping-checklist.md`.
