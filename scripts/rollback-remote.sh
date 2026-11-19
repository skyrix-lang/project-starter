#!/bin/sh
# Puts back what the last deploy replaced, on the server:
#   - the database, from the backup taken just before that deploy's
#     migrations, but only if a migration ran since (otherwise the data is
#     already right, and restoring would only lose what people wrote);
#   - the app: booking-platform-app:previous becomes booking-platform-app:current again, without
#     building anything.
# scripts/deploy-remote.sh runs it when the migration or the new version's
# health check fails, and scripts/deploy.sh when the public address doesn't
# answer after a deploy. Also by hand. Run from DEPLOY_DIR/src.
set -eu

compose_file="docker/compose.production.yaml"
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "$compose_file" "$@"; }
else
  compose() { docker-compose -f "$compose_file" "$@"; }
fi
dir=$(cd "$(dirname "$0")/../.." && pwd)

if ! docker image inspect booking-platform-app:previous >/dev/null 2>&1; then
  echo "No previous version on this server (booking-platform-app:previous): nothing to roll back to." >&2
  exit 1
fi

# Written by a deploy in progress, deleted when one succeeds: without it,
# there's no deploy to undo in the database, only the image.
backup=$(sed -n 's/^backup=//p' "$dir/deploy-state" 2>/dev/null || true)
before=$(sed -n 's/^migrations=//p' "$dir/deploy-state" 2>/dev/null || true)
now=$(sh scripts/migrations-remote.sh || echo unknown)
if [ -z "$before" ]; then
  echo "No deploy in progress: the database stays as it is."
elif [ "$now" = "$before" ]; then
  echo "No migration ran: the database stays as it is."
else
  echo "Migrations ran ($before → $now): restoring the database from before the deploy."
  # The previous image starts even if the restore fails: better the old app
  # than none, and the failure says to look now.
  sh scripts/restore-remote.sh "$backup" ||
    echo "THE DATABASE RESTORE FAILED: the previous version runs on the migrated database. Restore by hand (docs/deployment.md, \"Backups\")." >&2
fi

docker tag booking-platform-app:previous booking-platform-app:current
compose up -d --no-build --force-recreate --wait app
# The deploy is undone: a later rollback must not restore this backup again.
rm -f "$dir/deploy-state"
echo "Rolled back: the previous version is running again."
compose ps
