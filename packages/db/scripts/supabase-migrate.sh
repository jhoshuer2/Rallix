#!/usr/bin/env bash
# Apply new migrations to your Supabase database. Run on YOUR machine (needs psql and pnpm).
# Safe to run any time: already-applied migrations are skipped. Only the migration role's password is reset
# (it is used for nothing else), so your app and service connection strings keep working.
#   SUPABASE_ADMIN_URL   postgres-user URL of the Session pooler (port 5432), as in DEPLOY.md
#   SUPABASE_POOLER_HOST, SUPABASE_PROJECT_REF
#   SUPABASE_DB_PASSWORD  your database password (use this instead of SUPABASE_ADMIN_URL; any characters are fine, no URL encoding)
set -euo pipefail
: "${SUPABASE_POOLER_HOST:?}" "${SUPABASE_PROJECT_REF:?}"
if [ -n "${SUPABASE_DB_PASSWORD:-}" ]; then
  export PGPASSWORD="$SUPABASE_DB_PASSWORD"
  ADMIN_CONN="host=$SUPABASE_POOLER_HOST port=5432 dbname=postgres user=postgres.$SUPABASE_PROJECT_REF sslmode=require"
else
  : "${SUPABASE_ADMIN_URL:?Set SUPABASE_DB_PASSWORD (or SUPABASE_ADMIN_URL)}"
  ADMIN_CONN="$SUPABASE_ADMIN_URL"
fi
OWNER_PW="$(openssl rand -hex 24)"
# psql does not substitute variables with -c, so the statement goes in on stdin.
echo "ALTER ROLE rallix_owner PASSWORD :'owner_pw'" | psql "$ADMIN_CONN" -v ON_ERROR_STOP=1 -q -v owner_pw="$OWNER_PW" -f -
retry() { local n=0; until "$@"; do n=$((n+1)); [ "$n" -ge 24 ] && { echo "giving up after $n tries" >&2; return 1; }; echo "pooler not ready yet (try $n/24), waiting 15s..."; sleep 15; done; }
export DATABASE_SSL=no-verify
retry env DATABASE_URL_OWNER="postgres://rallix_owner.$SUPABASE_PROJECT_REF:$OWNER_PW@$SUPABASE_POOLER_HOST:5432/postgres" pnpm --filter @rallix/db migrate
echo "Migrations are up to date."
