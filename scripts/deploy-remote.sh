#!/bin/sh
# The server's half of `yarn deploy` (scripts/deploy.sh runs it there, from
# the deployed commit):
#   1. build the new image, keeping the running one as booking-platform-app:previous;
#   2. stop the app, so the data stays still from the backup on;
#   3. back up the database, prove the backup restores, upload it to R2
#      (scripts/backup-remote.sh): if any of it fails, the old app starts
#      again and nothing is migrated;
#   4. migrate, then start the new version and wait for its health check.
# If 4 fails, scripts/rollback-remote.sh restores the database from that
# backup (only if a migration ran) and starts the previous image. The app was
# stopped since the backup, so nothing written in between is lost.
set -eu

compose_file="docker/compose.production.yaml"
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -f "$compose_file" "$@"; }
else
  compose() { docker-compose -f "$compose_file" "$@"; }
fi
dir=$(cd .. && pwd)

if docker buildx version >/dev/null 2>&1; then
  export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
else
  # Docker's old builder doesn't know `RUN --mount`, which only caches Yarn's
  # downloads between builds. This copy of the Dockerfile does without it.
  echo "No BuildKit on this server: building without the download cache." >&2
  echo "Install it for faster builds: sudo apt install docker-buildx" >&2
  sed -i 's/--mount=type=cache,target=[^ ]* //' docker/Dockerfile
fi

# The running version, kept before the build replaces the name. Older
# deploys used compose's default name, booking-platform-app:latest.
for running in booking-platform-app:current booking-platform-app:latest; do
  if docker image inspect "$running" >/dev/null 2>&1; then
    docker tag "$running" booking-platform-app:previous
    break
  fi
done

# Both images, by name: `migrate` has a profile, so a plain `build` skips it
# and the next release would run the previous release's migrations. Built
# while the old version still serves people.
compose build app migrate

# From here until the new version answers, people see the proxy's error
# page: at 2:00, for about a minute.
compose stop app
if ! BACKUP_COMPARE_ROWS=1 sh scripts/backup-remote.sh; then
  echo "The backup failed: not deploying. The old version starts again." >&2
  compose start app
  exit 1
fi
# What a rollback needs: which backup, and how many migrations had run.
migrations() { sh scripts/migrations-remote.sh; }
{
  echo "backup=$(cat "$dir/backups/latest")"
  echo "migrations=$(migrations)"
} >"$dir/deploy-state"

if ! compose run --rm migrate; then
  echo "The migration failed: rolling back." >&2
  sh scripts/rollback-remote.sh || true
  exit 1
fi
# Waits for the health check.
if ! compose up -d --wait app; then
  echo "The new version isn't healthy: rolling back." >&2
  sh scripts/rollback-remote.sh || true
  exit 1
fi
# This project's leftovers only: the server runs other things. Untagged
# images only, so booking-platform-app:previous stays for a rollback.
docker image prune -f --filter "label=com.docker.compose.project=booking-platform" >/dev/null
compose ps
