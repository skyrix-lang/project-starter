#!/bin/sh
# Puts the production database back as a backup holds it, on the server:
#   sh scripts/restore-remote.sh [backup file]   (default: the latest backup)
# The app is stopped first and left stopped: start the version that matches
# the data afterwards (scripts/rollback-remote.sh does both).
#
# One transaction: the schemas are dropped and the backup restored together,
# so a restore that fails halfway leaves the database as it was. The
# database's user must own the database (it drops and creates `public`).
# Run from the deployed commit (DEPLOY_DIR/src).
set -eu

dir=$(cd "$(dirname "$0")/../.." && pwd)
network=${BACKUP_NETWORK:-nginx-proxy}
compose_file="docker/compose.production.yaml"
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "$compose_file" "$@"; }
else
  compose() { docker-compose -f "$compose_file" "$@"; }
fi

value() {
  sed -n "s/^$1=//p" "$2" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

file=${1:-$(cat "$dir/backups/latest" 2>/dev/null || true)}
[ -n "$file" ] && [ -s "$file" ] || {
  echo "No backup to restore (${file:-none}). Older ones are in R2: download one to $dir/backups and pass its path." >&2
  exit 1
}
url=$(value DATABASE_URL "$dir/.env.production")
[ -n "$url" ] || { echo "No DATABASE_URL in $dir/.env.production." >&2; exit 1; }

num=$(docker run --rm --network "$network" postgres:18-alpine psql -X -At "$url" -c "show server_version_num")
image="postgres:$((num / 10000))-alpine"

echo "Stopping the app, then restoring $(basename "$file")…"
compose stop app >/dev/null 2>&1 || true
# The backup as SQL, after dropping what's there now (new tables a failed
# release added included). public is created again here: the dump doesn't.
{
  echo "SET client_min_messages = warning;"
  echo "DROP SCHEMA IF EXISTS drizzle CASCADE;"
  echo "DROP SCHEMA IF EXISTS public CASCADE;"
  echo "CREATE SCHEMA public;"
  docker run --rm -i "$image" pg_restore --no-owner --no-privileges -f - <"$file" |
    sed '/^CREATE SCHEMA public;$/d'
} | docker run --rm -i --network "$network" "$image" \
  psql -X -q -v ON_ERROR_STOP=1 --single-transaction "$url" >/dev/null
echo "Database restored from $(basename "$file"). The app is stopped."
