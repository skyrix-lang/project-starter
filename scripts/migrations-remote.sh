#!/bin/sh
# Prints how many migrations the production database has applied (0 before
# the first): a rollback compares it with the count before the deploy to know
# whether the database must be restored too. Fails when the database can't be
# reached, rather than printing a count it doesn't know. Run from
# DEPLOY_DIR/src.
set -eu

dir=$(cd "$(dirname "$0")/../.." && pwd)
url=$(sed -n 's/^DATABASE_URL=//p' "$dir/.env.production" | tail -n 1 |
  sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/")
psql_at() {
  docker run --rm --network "${BACKUP_NETWORK:-nginx-proxy}" postgres:18-alpine \
    psql -X -At -v ON_ERROR_STOP=1 "$url" -c "$1"
}
if [ "$(psql_at "select to_regclass('drizzle.__drizzle_migrations') is not null")" = t ]; then
  psql_at "select count(*) from drizzle.__drizzle_migrations"
else
  echo 0
fi
