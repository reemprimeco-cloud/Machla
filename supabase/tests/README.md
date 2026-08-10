# SQL test suite

Exercises the migrations in `../migrations/` directly against Postgres —
without Supabase, and without the Next.js app.

That target is deliberate. HomeList puts its authorization in the
database (Row Level Security plus `SECURITY DEFINER` RPCs, see
`docs/architecture/10-security-model.md` §1), so testing through the UI
would only prove the UI asks nicely. These tests prove the database
refuses, which is the guarantee that actually holds when someone calls
the API directly with the anon key.

## Running

```bash
./supabase/tests/run-tests.sh
```

Requires a local PostgreSQL and permission to create databases; the
script drops and recreates `homelist_test` (override with
`HOMELIST_TEST_DB`) on every run. It applies `00_test_harness.sql`, then
every migration in order, then each numbered test file.

The suite is **not** idempotent by design — it asserts on exact row
counts and on one-shot transitions (an invitation can only be accepted
once), so a clean database each run is what makes those assertions
meaningful.

## Files

| File | Purpose |
|---|---|
| `00_test_harness.sql` | Stubs what Supabase provides: `auth.users`, `auth.uid()` (read from the `request.jwt.claim.sub` GUC, so tests can switch identity), the `anon`/`authenticated` roles, and Supabase's default **table and function** grants. Plus the assertion helpers. |
| `01_phase4_households_test.sql` | Phase 4: household creation, invitations, membership, removal, and cross-household isolation. |
| `02_function_grants_test.sql` | Who may `EXECUTE` each function, and that every function pins its `search_path`. |
| `03_phase5_catalog_test.sql` | Phase 5: the catalogue carries no price column, is world-readable but client-unwritable, imports idempotently via `natural_key`, groups deterministically, and searches across all nine languages plus brand and transliteration. |
| `04_phase6_worker_lists_test.sql` | Phase 6: the worker's draft lifecycle — one draft per person, a draft is editable only by its author (not by a fellow worker, not by the owner), a sent list is immutable, grouping survives re-categorization, and no worker-reachable path writes purchase state. |
| `05_phase7_household_lists_test.sql` | Phase 7: the household receives a list, identifies its sender, works the checklist, and completes it — plus the mirror of Phase 6's guarantee, that a Worker cannot set purchase state even on a list they wrote. |
| `06_phase8_notifications_test.sql` | Phase 8: notification creation/read-state/preferences, notifications are private and unforgeable, a Worker sees only their own lists, list history — and the master plan's own §16A.12 acceptance scenario end to end. |

## Conventions

- `test_assert(condition, label)` — fails the run if the condition isn't true.
- `test_raises(sql, expected_substring, label)` — asserts the statement
  raises, and that the message matches. Used for every "must be
  forbidden" case that the database rejects outright.
- `test_login(uuid)` — switches the acting identity (`null` = signed out).
- `set role authenticated` — required for any test of RLS itself, since
  the superuser the migrations run as bypasses policies entirely.

One asymmetry worth knowing when adding tests: an `INSERT` blocked by RLS
**raises**, but an `UPDATE` or `DELETE` blocked by RLS simply matches
zero rows and returns quietly. So "this write must not be possible" is
asserted with `test_raises` for inserts, and by re-reading the row and
asserting it is unchanged for updates and deletes. Using `test_raises`
for an update would pass vacuously and prove nothing.

## Why `02_function_grants_test.sql` exists

Behavioural tests cannot catch a missing `EXECUTE` revoke. Every RPC in
`01_*.sql` also checks `auth.uid()` internally, so the suite passes
whether or not `anon` can call it — the function refuses anonymous
callers either way. The one function that *has* no internal check,
`expire_stale_invitations()`, is exactly the one that shipped to a live
project callable by anyone holding the (public) anon key.

The root cause was that `revoke ... from public` looks sufficient but
isn't: Supabase grants `EXECUTE` on `public` functions **directly** to
`anon` and `authenticated` as well, and `has_function_privilege()` is
true if the privilege arrives by either route. The harness now models
those default function grants, and `02_*.sql` asserts on privileges
rather than behaviour, so the gap fails locally instead of in
production.

When adding assertions there, scope them to *application* functions —
the view at the top of the file excludes extension members (pgcrypto,
which Supabase keeps in the `extensions` schema but a plain Postgres
puts in `public`) and the `test_*` helpers. An unscoped
"anon can execute nothing" assertion fires on those and tells you
nothing about HomeList.
