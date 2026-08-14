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
  (Phase 1 `locales`) is portable — an Expo app re-uses the same
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

1. Extract `lib/{supabase,auth,catalog}` and `types/` into
   `packages/{database,auth,catalog,types}` (mechanical, per
   `09-folder-structure.md` §3).
2. Extract `locales` into `packages/i18n`.
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

---

## Phase 12 — as built, and what was deliberately not built

**No native app exists.** The master plan is explicit — do not build them,
validate the web application first — and that instruction is followed.

What Phase 12 produced is `18-backend-contract.md`: the complete read and
RPC surface a native client will consume, the error-code list it should
mirror, and the product behaviours it must preserve (absolute quantities,
snapshotted categories, item-count progress, deterministic ordering, frozen
sent lists). It exists so that a second client consumes the same API rather
than inventing a parallel one, and so anyone changing an RPC can see who
depends on it.

### The portability claim, measured rather than asserted

This document has claimed since Phase 0 that business logic pushed into
Postgres is a stronger form of "share, don't duplicate" than a shared
JavaScript package. Phase 12 checked it by auditing every module's imports:

- **13 modules have no framework coupling at all** — the i18n layer, the
  localized-name helpers, the error-code contracts, the Supabase client and
  types, phone/locale helpers, branding. These are the first `packages/`
  extraction and would work unchanged in React Native.
- **12 modules are Next.js server-only** — every `queries.ts`,
  `actions.ts`, the route guards, the SSR session refresh.

The second number is the interesting one, and it is not a problem: those
files are thin wrappers around the RPCs. They hold no business rules. A
native client rewrites that layer in whatever its platform prefers and gets
identical behaviour — including identical *refusals* — because the rules
live in the database, not in the wrapper.

`lib/i18n/cookie.ts` is the one module worth flagging on extraction: its
logic is portable, its storage (`document.cookie`) is not. A native client
swaps the storage and keeps the logic.

### Still the honest blocker

The web application has not been validated by real use, because phone auth
is not enabled and no SMS provider is chosen. "Validate the web app first"
cannot start until that does. Building a native client before then would be
building on an unvalidated product — which is precisely what this phase's
first line forbids.

---

## 2026-08 — what actually happened, and why it isn't §4

This document predicted the store apps as **Expo rewrites**: extract the
shared modules into packages, then build `apps/worker-app` and
`apps/household-app` as native React Native clients. That is still the
right shape *if the goal is native screens*. It was not the goal.

The goal was the one in §4.4 — push notifications — and the request that
produced it ("تطبيق ابل مربوط بالموقع… مع الاشعارات افضل") asked for an
app **linked to the website**, not a second implementation of it. Two
rewritten clients would have meant every future change made three times,
in three languages, released on three schedules, for a household product
whose screens are a list and a grid.

So both store apps are shells over the deployed web app:

| | What ships | Where it lives |
|---|---|---|
| Android | Trusted Web Activity — Chrome renders the live site full-screen | `android-twa/` |
| iOS | `WKWebView` in a native app, plus APNs | `ios/` |

`ios/README.md` and `android-twa/README.md` carry the operational
detail. What matters architecturally is the trade this makes:

- **What it buys.** One codebase, still. A change deployed to Vercel is
  live in both apps on next launch, with no review queue and no version
  skew — which for a 12-language product with a live catalogue is worth
  more than native scroll physics.
- **What it costs.** No native screens, so no native gesture feel and no
  offline reading of a list. Both were already true of the PWA, and both
  remain available later: nothing here forecloses §4.

### Push is the one thing the shell had to add

Web Push covers browsers, the installed PWA (iOS 16.4+), and the Android
TWA, which runs on Chrome's engine and inherits it. It does **not** cover
an iOS App Store build: Safari grants the Push API only to a site the
user installed to their own Home Screen, so inside a `WKWebView` there is
no `PushManager` to subscribe with. That single platform fact is the
whole reason `ios/` contains any Swift at all.

The response was a second **transport**, not a second notification
system. `push_subscriptions` gained a `platform` column and an APNs
device is just another row
(`20260814100000_apns_push.sql`); `get_pending_pushes` still returns one
result set and `sendPendingPushes` still runs one loop. This is the same
rule `20260812140000` set for Web Push — push is "a reader of this table
rather than a second, parallel notification path that can disagree with
it" — held to across a platform boundary rather than abandoned at it. An
iPhone and an Android in one household cannot be told different things
about the same list, because nothing decides anything twice.

### The CSP forced the bridge's design

Every web-to-native framework — Capacitor included — injects a JavaScript
bridge into the page. This app serves
`script-src 'self' 'nonce-…' 'strict-dynamic'` (`proxy.ts`), and an
injected script carries neither the nonce nor a hash the page vouches
for, so WebKit is entitled to refuse it. The framework path therefore
required weakening the app's main XSS defence for packaging convenience.

The bridge uses the two channels a content policy cannot reach instead,
because neither is a script the page loaded: `messageHandlers` going in,
`evaluateJavaScript` coming out. Once that decision was made, the
framework had nothing left to contribute, which is why `ios/` has no
third-party runtime — six Swift files and no dependency manager.

The pleasant side effect is that the entire native surface is legible:
three requests in, two callbacks out, stated in one file on each side
(`lib/native/bridge.ts`, `ios/Machla/NativeBridge.swift`). A framework's
bridge exposes every plugin it ships; this one exposes what it uses.
