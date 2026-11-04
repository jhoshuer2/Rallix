#!/usr/bin/env bash
# Run browser suites one after another, each on a freshly seeded database.
#   scripts/e2e-run.sh prod full-flow screens ...    (production build; the default mode in CI)
#   scripts/e2e-run.sh dev  full-flow                (next dev)
# Suite names are the files in apps/club/e2e (without .cjs), plus `console` for apps/console/e2e/full-flow.cjs.
# Prints one line per suite and exits non-zero if any failed. Server logs and per-suite output go to $E2E_LOGS (default /tmp/rallix-e2e).
set -uo pipefail
MODE="${1:-prod}"; shift || true
[ "$#" -gt 0 ] || { echo "usage: $0 [dev|prod] suite [suite...]"; exit 2; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
export E2E_LOGS="${E2E_LOGS:-/tmp/rallix-e2e}"; mkdir -p "$E2E_LOGS"
export DEV_LOG="$E2E_LOGS/club.log" CLUB_LOG="$E2E_LOGS/club.log" CLUB_DEV_LOG="$E2E_LOGS/club.log" CONSOLE_LOG="$E2E_LOGS/console.log" OUT="$E2E_LOGS"
failed=0; first=1
for t in "$@"; do
  if [ "$t" = console ]; then f="apps/console/e2e/full-flow.cjs"; else f="apps/club/e2e/$t.cjs"; fi
  [ -f "$f" ] || { echo "== $t: no such suite ($f)"; failed=1; continue; }
  E2E_SKIP_BUILD=$([ "$first" = 1 ] && echo 0 || echo 1) bash scripts/e2e-up.sh "$MODE" > "$E2E_LOGS/up-$t.out" 2>&1 || { echo "== $t: apps did not start"; tail -15 "$E2E_LOGS/up-$t.out"; failed=1; first=0; continue; }
  first=0
  if [ "$MODE" = dev ]; then for u in sign-in welcome onboarding join/NOPE1234 competition play profile members; do curl -s -o /dev/null -m 150 "localhost:3000/$u" || true; done; fi
  timeout 1200 node "$f" > "$E2E_LOGS/$t.out" 2>&1
  cp "$E2E_LOGS/club.log" "$E2E_LOGS/club-$t.log" 2>/dev/null || true
  line="$(grep -E 'passed|CRASH' "$E2E_LOGS/$t.out" | tail -1)"; fails="$(grep -c '  FAIL' "$E2E_LOGS/$t.out" || true)"
  echo "== $t: ${line:-no result} | fails: $fails"
  if [ "$fails" != 0 ] || ! grep -qE ' 0 failed' "$E2E_LOGS/$t.out"; then failed=1; grep -E '  FAIL|CRASH' "$E2E_LOGS/$t.out" | head -8; fi
done
exit $failed
