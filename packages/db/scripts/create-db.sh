#!/usr/bin/env bash
# Create (or recreate) a local database owned by rallix_owner. Usage: create-db.sh <dbname>
# Locally this uses the `postgres` system user. In CI set RALLIX_PG_ADMIN to an admin connection string
# (for example postgres://postgres:postgres@localhost:5432/postgres) and psql connects over TCP instead.
set -euo pipefail
DB="${1:-rallix_dev}"
HERE="$(cd "$(dirname "$0")" && pwd)"
if [ -n "${RALLIX_PG_ADMIN:-}" ]; then
  BASE="${RALLIX_PG_ADMIN%/*}"
  psql "$RALLIX_PG_ADMIN" -v ON_ERROR_STOP=1 -q -f "$HERE/bootstrap-roles.sql"
  psql "$RALLIX_PG_ADMIN" -q -c "DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)"
  psql "$RALLIX_PG_ADMIN" -q -c "CREATE DATABASE \"$DB\" OWNER rallix_owner"
  psql "$BASE/$DB" -q -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;'
else
  su postgres -c "psql -v ON_ERROR_STOP=1 -q -f '$HERE/bootstrap-roles.sql'"
  su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)'"
  su postgres -c "psql -q -c 'CREATE DATABASE \"$DB\" OWNER rallix_owner'"
  su postgres -c "psql -q -d '$DB' -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;'"
fi
echo "created $DB"
