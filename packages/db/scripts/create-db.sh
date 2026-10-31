#!/usr/bin/env bash
# Create (or recreate) a local database owned by rallix_owner. Usage: create-db.sh <dbname>
set -euo pipefail
DB="${1:-rallix_dev}"
HERE="$(cd "$(dirname "$0")" && pwd)"
su postgres -c "psql -v ON_ERROR_STOP=1 -q -f '$HERE/bootstrap-roles.sql'"
su postgres -c "psql -q -c 'DROP DATABASE IF EXISTS \"$DB\" WITH (FORCE)'"
su postgres -c "psql -q -c 'CREATE DATABASE \"$DB\" OWNER rallix_owner'"
su postgres -c "psql -q -d '$DB' -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS citext;'"
echo "created $DB"
