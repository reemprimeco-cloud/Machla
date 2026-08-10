# 12 — Future Worker App / Household App Architecture

## 1. Principle

One backend, eventually three clients. V1 ships **one** client (the PWA);
`HomeList Worker` and `HomeList Home` (native, React Native/Expo,
Phase 12+) are additive, not a rewrite, because the boundary between
"worker experience" and "household experience" is already drawn at the
route-group level (`08-route-map.md`) and the business-rule boundary is
already drawn at the Postgres RPC level (`10-security-model.md`), not
inside React components.

```text
                     ┌─────────────────────────────┐
                     │           Supabase            │
                     │  Auth · Postgres+RLS · RPCs   │
                     │  · Storage                     │
                     └───────────┬─────────────────┘
                 ┌────────────────┼────────────────┐
                 ▼                ▼                ▼
        ┌────────────────┐ ┌──────────────┐ ┌──────────────┐
        │  HomeList PWA    │ │ HomeList     │ │ HomeList     │
        │  (V1, web,       │ │ Worker       │ │ Home         │
        │  both personas)  │ │ (future,     │ │ (future,     │
        │                  │ │  Expo)       │ │  Expo)       │
        └────────────────┘ └──────────────┘ └──────────────┘
```

## 2. What's already shared (built once, in Phase 0's design, reused by all three)

- **Auth**: phone + OTP via Supabase Auth — a native app uses the same
  Supabase project and the same `users`/`household_members` tables, no
  parallel identity system.
- **Authorization**: RLS policies and RPC functions
  (`create_invitation`, `accept_invitation`, `set_purchase_status`,
  etc.) are the actual business logic. A native client calls the same
  RPCs the web client calls — the rules are not reimplemented per
  platform.
- **Data**: one Postgres schema, one set of tables. No per-client data
  duplication or sync layer.
- **Product catalog**: one `products`/`categories` table, populated once
  by the Phase 5 import pipeline, read by every client.
- **Localization strings**: the master-plan rule "UI translations stored
  in structured locale files" means the *content* of `locales/*.json`
  (Phase 1 `apps/web/locales`) is portable — an Expo app re-uses the same
  JSON files (copied or, once a second client exists, pulled from a
  shared `packages/i18n`), not a redesigned translation set.

## 3. What each future client would keep and drop

| | Keeps | Drops |
|---|---|---|
| `HomeList Worker` | `(worker)` route-group's screens re-implemented as native screens; category browsing, product selection, quantity, search, "My Usual Items", send | Household dashboard, member/invitation management, purchase checklist |
| `HomeList Home` | `(household)` route-group's screens; dashboard, grouped list + purchase checklist + progress, member/invitation management, settings | Product category browsing/selection flow (owners don't shop in-app) |

This split is not hypothetical scaffolding — it is a direct consequence
of the permission matrix (`04-roles-permission-matrix.md`): a Worker
account is never authorized to see household-management screens, and an
Owner/Member account never needs the product-selection flow, so the
native split falls out of the existing RLS/role boundary rather than
requiring new product decisions later.

## 4. Migration path, when Phase 12 actually starts

1. Extract `apps/web/lib/{supabase,auth,catalog}` and `types/` into
   `packages/{database,auth,catalog,types}` (mechanical, per
   `09-folder-structure.md` §3).
2. Extract `apps/web/locales` into `packages/i18n`.
3. Scaffold `apps/worker-app` and `apps/household-app` (Expo), each
   consuming the extracted packages plus the Supabase JS client (which
   has React Native support).
4. Push notifications (native APNs/FCM) are added at this point — V1's
   in-app-only notification model (master plan Section 22) is what makes
   this deferrable without a redesign, since no notification delivery
   mechanism is baked into V1's data model beyond list/item status
   columns that any delivery channel can read.

## 5. Explicit non-goals for V1 / Phase 0

- No native app code, no Expo project, no React Native dependency is
  added now.
- No push notification infrastructure now (master plan Section 22 — V1
  is in-app notifications only).
- No offline-first sync engine now — the PWA's "offline-friendly
  behavior" (Phase 9) is basic (cached shell, graceful degradation), not
  a full offline data-sync layer; that's a native-app-era concern.

---

## Phase 9 — offline behaviour (relevant to the future native apps)

The service worker's strategy is worth carrying forward, because a native
app faces the same question with the same answer.

```text
navigations   → network first, cache fallback, then /offline
static assets → cache first (build output, fonts, icons, flags)
everything else (Supabase, Server Actions, POSTs) → network only
```

The third line is the load-bearing one. Authenticated API responses are
**never** cached: they are per-user, they go stale the moment anyone else
touches the list, and a cached one could show household A's data inside a
household B session on a shared phone — which is exactly the device
situation this product is built for.

Nor is an offline write queue implemented. It would be the natural next
step, and it is deliberately not taken in V1: the list lives in Postgres,
and telling a worker their item was added when it was only queued locally
is worse than telling them there is no connection. `/offline` says so, and
the connection banner says it persistently while the device is offline —
without it, a tap that does nothing reads as the app being broken rather
than the signal being gone.

A native client should reach the same conclusion, or implement a real
queue with real conflict handling — not a cache that pretends.
