#!/usr/bin/env bash
# Runs the HomeList SQL test suite against a local PostgreSQL instance.
#
# The suite is intentionally NOT idempotent — it asserts on exact row
# counts and on one-shot state transitions (an invitation can only be
# accepted once), so it needs a clean database each run. This script
# drops and recreates one, applies the harness and every migration in
# order, then runs each test file.
#
#   ./supabase/tests/run-tests.sh
#
# Requires a running local PostgreSQL and permission to create databases.
# No Supabase project is involved: supabase/tests/00_test_harness.sql
# stubs auth.users / auth.uid() and the anon + authenticated roles.

set -euo pipefail

DB_NAME="${HOMELIST_TEST_DB:-homelist_test}"
PSQL_USER="${HOMELIST_TEST_PSQL_USER:-postgres}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_sql() {
  psql -d "$DB_NAME" -v ON_ERROR_STOP=1 -q -f "$1"
}

if [ "$(id -un)" != "$PSQL_USER" ] && command -v su >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
  # Re-exec as the postgres role when invoked as root (the usual case in
  # a container), copying the tree somewhere that role can read.
  WORK_DIR="$(mktemp -d)"
  cp -r "$ROOT_DIR/supabase" "$WORK_DIR/"
  chmod -R a+rX "$WORK_DIR"
  trap 'rm -rf "$WORK_DIR"' EXIT

  su "$PSQL_USER" -c "psql -q -c 'DROP DATABASE IF EXISTS $DB_NAME;'"
  su "$PSQL_USER" -c "psql -q -c 'CREATE DATABASE $DB_NAME;'"

  su "$PSQL_USER" -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -q -f $WORK_DIR/supabase/tests/00_test_harness.sql"
  for migration in "$WORK_DIR"/supabase/migrations/*.sql; do
    echo "-- applying $(basename "$migration")"
    su "$PSQL_USER" -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -q -f $migration"
  done
  for test_file in "$WORK_DIR"/supabase/tests/[0-9][1-9]_*.sql; do
    echo "-- running $(basename "$test_file")"
    su "$PSQL_USER" -c "psql -d $DB_NAME -v ON_ERROR_STOP=1 -q -f $test_file"
  done
  exit 0
fi

psql -q -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -q -c "CREATE DATABASE $DB_NAME;"

run_sql "$ROOT_DIR/supabase/tests/00_test_harness.sql"
for migration in "$ROOT_DIR"/supabase/migrations/*.sql; do
  echo "-- applying $(basename "$migration")"
  run_sql "$migration"
done
for test_file in "$ROOT_DIR"/supabase/tests/[0-9][1-9]_*.sql; do
  echo "-- running $(basename "$test_file")"
  run_sql "$test_file"
done
