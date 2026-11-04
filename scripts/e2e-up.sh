#!/usr/bin/env bash
# Start both apps for browser tests on a freshly seeded database.
#   scripts/e2e-up.sh prod   production build and `next start` (what CI runs; the default)
#   scripts/e2e-up.sh dev    `next dev` (slower, and restarts itself under a long crawl)
# Logs go to $E2E_LOGS (default /tmp/rallix-e2e): club.log and console.log. The tests read sign-in codes from them.
# Database: a local Postgres with the Rallix roles (see packages/db/README.md). In CI set RALLIX_PG_ADMIN to an admin connection string.
set -euo pipefail
MODE="${1:-prod}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="${E2E_LOGS:-/tmp/rallix-e2e}"; mkdir -p "$LOGS"
DB="${PGDB:-rallix_dev}"
cd "$ROOT"

# Stop anything we started before (only processes whose working directory is inside this repo).
for p in $(ps aux | grep -E "next-server|next start|next dev" | grep -v grep | awk '{print $2}'); do
  case "$(readlink /proc/$p/cwd 2>/dev/null)" in "$ROOT"/*) kill "$p" 2>/dev/null || true;; esac
done
sleep 1

export DATABASE_URL_OWNER="postgres://rallix_owner:owner_dev@localhost:5432/$DB"
export DATABASE_URL_APP="postgres://rallix_app:app_dev@localhost:5432/$DB"
export DATABASE_URL_SERVICE="postgres://rallix_service:service_dev@localhost:5432/$DB"
(cd packages/db && ./scripts/create-db.sh "$DB" >/dev/null && pnpm exec tsx src/migrate.ts >/dev/null && pnpm exec tsx src/seed.ts >/dev/null)

# Test-only settings. The real production guards stay on: RALLIX_CI_E2E is honoured only off Vercel with every database on this machine.
common() {
  export BETTER_AUTH_SECRET="e2e-better-auth-secret-0123456789abcdef" UNSUBSCRIBE_SECRET="e2e-unsubscribe-secret-0123456789ab"
  export CRON_SECRET="dev-cron-secret-shared-0001" MAIL_PROVIDER=console MAIL_FROM="Rallix <no-reply@example.com>" MAIL_FAIL_ADDRESSES="fail@example.com"
  export PAYMENTS_PROVIDER=fake STORAGE_PROVIDER=local RALLIX_CI_E2E=1
  export NODE_OPTIONS="--max-old-space-size=4096"
}
common
if [ "$MODE" = "prod" ]; then
  # E2E_SKIP_BUILD=1 reuses the build from a previous call (the runner builds once, then restarts the apps on a fresh database per suite).
  if [ "${E2E_SKIP_BUILD:-}" != "1" ] || [ ! -d apps/club/.next ] || [ ! -d apps/console/.next ]; then
  rm -rf apps/club/.next apps/console/.next
  pnpm turbo build --filter=@rallix/club --filter=@rallix/console > "$LOGS/build.log" 2>&1 || { tail -30 "$LOGS/build.log"; exit 1; }
  fi
  START="start"
else
  rm -rf apps/club/.next apps/console/.next
  START="dev"
fi
(cd apps/club && BETTER_AUTH_URL=http://localhost:3000 APP_URL=http://localhost:3000 CLUB_APP_URL=http://localhost:3000 nohup node_modules/.bin/next $START --port 3000 > "$LOGS/club.log" 2>&1 &)
(cd apps/console && BETTER_AUTH_URL=http://localhost:3001 CLUB_APP_URL=http://localhost:3000 nohup node_modules/.bin/next $START --port 3001 > "$LOGS/console.log" 2>&1 &)

for port in 3000 3001; do
  for i in $(seq 1 120); do
    curl -fsS -m 3 "http://localhost:$port/api/health" >/dev/null 2>&1 && break
    sleep 1
    [ "$i" = 120 ] && { echo "app on :$port did not come up"; tail -20 "$LOGS/$([ $port = 3000 ] && echo club || echo console).log"; exit 1; }
  done
done
echo "ready ($MODE): club http://localhost:3000, console http://localhost:3001, logs in $LOGS"
