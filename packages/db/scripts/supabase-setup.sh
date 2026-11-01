#!/usr/bin/env bash
# One-time Supabase setup. Run on YOUR machine (needs psql and pnpm). Secrets come from the environment, never arguments.
#   SUPABASE_ADMIN_URL  postgres-user URL of the Session pooler (port 5432), from Supabase: Connect > Session pooler
#   SUPABASE_POOLER_HOST  e.g. aws-0-eu-west-1.pooler.supabase.com   SUPABASE_PROJECT_REF  e.g. dihsahdbmpkbyzisskrw
# Passwords for the three roles are generated here and printed ONCE at the end: copy them into Vercel.
set -euo pipefail
: "${SUPABASE_ADMIN_URL:?}" "${SUPABASE_POOLER_HOST:?}" "${SUPABASE_PROJECT_REF:?}"
HERE="$(cd "$(dirname "$0")" && pwd)"
gen() { openssl rand -hex 24; }
OWNER_PW="$(gen)"; APP_PW="$(gen)"; SERVICE_PW="$(gen)"
psql "$SUPABASE_ADMIN_URL" -v ON_ERROR_STOP=1 -q -v owner_pw="$OWNER_PW" -v app_pw="$APP_PW" -v service_pw="$SERVICE_PW" -f "$HERE/bootstrap-roles.supabase.sql"
mk() { echo "postgres://$1.$SUPABASE_PROJECT_REF:$2@$SUPABASE_POOLER_HOST:$3/postgres"; }
export DATABASE_SSL=no-verify
DATABASE_URL_OWNER="$(mk rallix_owner "$OWNER_PW" 5432)" pnpm --filter @rallix/db migrate
# Verify the security model: the app role must not see sessions, and RLS must be on.
psql "$(mk rallix_app "$APP_PW" 5432)?sslmode=require" -tA -c "select has_table_privilege('rallix_app','sessions','SELECT')" | grep -qx f && echo "ok: app role cannot read sessions"
echo; echo "Put these in Vercel (Transaction pooler, port 6543), plus DATABASE_SSL=no-verify:"
echo "DATABASE_URL_APP=$(mk rallix_app "$APP_PW" 6543)"
echo "DATABASE_URL_SERVICE=$(mk rallix_service "$SERVICE_PW" 6543)"
echo "(owner password is only for migrations: DATABASE_URL_OWNER=$(mk rallix_owner "$OWNER_PW" 5432))"
