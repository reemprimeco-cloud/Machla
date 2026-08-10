# 16 — QA & Security Coverage Matrix (Phase 10)

Where each thing the master plan's Phase 10 asks for is actually verified.
The point of the table is traceability: if a row has no location, it is not
tested, and saying so is more useful than implying otherwise.

The SQL suite runs with `./supabase/tests/run-tests.sh` (260 assertions).
Browser checks are ephemeral Playwright runs, re-creatable from the
commands in §3.

## 1. Master plan Phase 10 checklist

| Requirement | Where | Notes |
|---|---|---|
| Authentication tests | `01`, `04`-`07` (`AUTH_REQUIRED` paths) | Signed-out callers refused by every RPC |
| Authorization tests | `01`, `04`, `05`, `07` | Role matrix enforced in Postgres |
| RLS tests | `04`-`07`, run as `authenticated` | Superuser bypasses RLS, so the role switch is what makes them real |
| Invitation security tests | `01` | Expiry, reuse, revocation, row-locking |
| Cross-household access tests | `04` §4, `05` §6, `06` §7 | Both RPC and direct-read paths |
| RTL tests | Playwright, 9 locales × 3 viewports | `dir`/`lang` asserted per locale |
| All 9 language tests | Playwright + `check-locales.mjs` | Key parity 147 keys × 9 |
| Mobile browser tests | Playwright at 320/375/412 | No viewport overflow on either edge |
| PWA install tests | §3 below | Manifest, icons, maskable, service worker |
| Performance tests | §2 below + `07` §2 | Advisors, indexes, transfer weight |
| Image optimization | Partial — see §4 | No photography exists yet |
| Search tests | `03` | Cross-language, brand, transliteration, limits |
| Duplicate submission tests | `07` §4 | Double join, double add, double send, double check-off |

## 2. Amendment 1 (§16A) automated tests

| Requirement | Where |
|---|---|
| Correct category grouping | `06` §1 (the §16A.12 scenario), `04` §8 |
| No random ordering | `03` (unique `sort_order`), `06` §1 |
| Purchase-status persistence | `05` §3, `06` §7 |
| Worker cannot modify purchase status | `05` §5, `04` §7 |
| Owner cannot modify requested quantity | `05` §3, `06` §1, `05` §8 (structural) |
| Progress calculation | `05` §3, `06` §1 |
| Cross-household isolation of lists | `05` §6, `06` §7 |
| Completed / unavailable states | `05` §3, §7 |

## 3. Browser checks (ephemeral)

Run against `npm run build && npm run start`, using the pre-installed
Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`:

- **Layout/RTL/i18n** — 3 viewports × 9 locales × 5 routes = 135 checks:
  no element overflows either viewport edge, `dir`/`lang` correct, no
  interactive target under 44×24px. Negative-controlled (see
  `15-localization-architecture.md` §10 — the first version was blind).
- **PWA** — manifest has `display: standalone`, 192/512 icons that
  resolve, and a **maskable** icon; the service worker registers and takes
  scope.

Routes behind authentication cannot be reached here (phone auth is not
configured), so the worker/household screens are audited through a
temporary preview route with hostile fixtures, removed afterwards.

## 4. Measured, and deliberately not fixed

**First-screen weight.** `/welcome` transfers ~773 KB, of which **~502 KB
is fonts** — it is the one screen that renders all five scripts at once
(the language picker shows every language in its own alphabet, which is
the entire point of the screen). Every later screen loads one family:
`/login` is ~404 KB, and the fonts are then cached.

The obvious fix — subsetting each font to just the glyphs in that
language's own name — is **not available**: `next/font/google` in this
version has no `text` option (checked in
`node_modules/next/dist/compiled/@next/font/dist/google/`, not assumed).
The alternatives are self-hosting hand-subsetted woff2 files or rendering
the names as SVG, both of which cost more than they save right now.

Mitigating factors, which is why this is recorded rather than hacked
around: the fonts are `display: swap` so nothing blocks on them, tier-2
fonts are `preload: false`, and each language row also carries a romanised
name and a flag, so the row is identifiable even before its font arrives.

**Image optimization.** Nothing to optimize yet — every `image_url` is
null and the UI renders per-type glyphs
(`11-product-catalog-architecture.md` §7.5). The uploader already resizes
and caps at 2 MB. This row becomes real when licensed photography lands.

## 5. Open advisor notices, and why

`get_advisors` reports four classes, all expected. Counts are not given
here on purpose — they move as Supabase adds lints and as the tables fill
— but nothing outside these four classes should be present, and anything
that is deserves investigation rather than the linter's suggested fix.

- **`authenticated_security_definer_function_executable`** — one per
  user-facing RPC, plus `is_active_member`. This is the design, not a
  finding: each function checks `auth.uid()` in its own body, which the
  linter cannot see, and it is exactly how a client is allowed to write
  anything at all (`18-backend-contract.md` §3).

  **Do not "fix" this by revoking `EXECUTE` from `authenticated`.** That
  would leave the application with no write path whatsoever, and RLS
  policies would fail outright, because they call `is_active_member`.
  `is_active_member` is safe to expose for a second reason worth stating:
  it takes no user id and resolves membership against `auth.uid()`, so a
  caller invoking it directly can only learn about themselves.

- **`unindexed_foreign_keys`** — five, each deliberate and argued in
  `20260809210000_phase10_performance.sql` §3: `households.owner_user_id`
  (one row per household; the members table is the real access path),
  `products.subcategory_id` (unused in V1), and three attribution columns
  never filtered on —`notifications.actor_user_id`,
  `shopping_list_items.purchased_by_user_id`, and
  `household_invitations.used_by_user_id`. An index is not free: it is
  paid on every write, and `shopping_list_items` is the hot table.

- **`unused_index`** — the tables are empty, so nothing has had occasion
  to use them. This lint only becomes informative after real traffic; the
  one index that was genuinely redundant
  (`products_search_keywords_gin_idx`) was dropped in Phase 10 §4 on the
  strength of an argument, not of this counter.

- **`auth_db_connections_absolute`** — a dashboard setting (fixed
  connection count for the Auth server). Owner's call at deploy time.
