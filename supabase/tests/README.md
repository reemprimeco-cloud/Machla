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
| `00_test_harness.sql` | Stubs what Supabase provides: `auth.users`, `auth.uid()` (read from the `request.jwt.claim.sub` GUC, so tests can switch identity), the `anon`/`authenticated` roles, and default table grants. Plus the assertion helpers. |
| `01_phase4_households_test.sql` | Phase 4: household creation, invitations, membership, removal, and cross-household isolation. |

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
