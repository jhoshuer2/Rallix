#!/usr/bin/env bash
# Apply new migrations to your Supabase database. Run on YOUR machine (needs psql and pnpm).
# Safe to run any time: already-applied migrations are skipped. Only the migration role's password is reset
# (it is used for nothing else), so your app and service connection strings keep working.
#   SUPABASE_ADMIN_URL   postgres-user URL of the Session pooler (port 5432), as in DEPLOY.md
#   SUPABASE_POOLER_HOST, SUPABASE_PROJECT_REF
set -euo pipefail
: "${SUPABASE_ADMIN_URL:?}" "${SUPABASE_POOLER_HOST:?}" "${SUPABASE_PROJECT_REF:?}"
OWNER_PW="$(openssl rand -hex 24)"
psql "$SUPABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -q -v owner_pw="$OWNER_PW" -c "ALTER ROLE rallix_owner PASSWORD :'owner_pw'"
retry() { local n=0; until "$@"; do n=$((n+1)); [ "$n" -ge 24 ] && { echo "giving up after $n tries" >&2; return 1; }; echo "pooler not ready yet (try $n/24), waiting 15s..."; sleep 15; done; }
export DATABASE_SSL=no-verify
retry env DATABASE_URL_OWNER="postgres://rallix_owner.$SUPABASE_PROJECT_REF:$OWNER_PW@$SUPABASE_POOLER_HOST:5432/postgres" pnpm --filter @rallix/db migrate
echo "Migrations are up to date."
