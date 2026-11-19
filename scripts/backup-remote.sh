#!/bin/sh
# Backs up the production database, on the server, and fails unless the
# backup is proven good:
#   1. pg_dump (custom format) with the server's own Postgres version;
#   2. restored into a throwaway Postgres container: it must restore without
#      error and hold the same tables (and, with BACKUP_COMPARE_ROWS=1, the
#      same number of rows: deploys stop the app first, so nothing changes);
#   3. uploaded to a Cloudflare R2 bucket, and the uploaded size checked.
# The last BACKUP_KEEP (7) backups stay on the server too, for a fast restore;
# R2 keeps them as long as its lifecycle rule says.
#
# Run from the deployed commit (DEPLOY_DIR/src). It reads DATABASE_URL from
# DEPLOY_DIR/.env.production, and R2's settings from DEPLOY_DIR/backup.env
# (never committed; see "Backups" in the README). It writes the backup's path
# to DEPLOY_DIR/backups/latest. scripts/deploy-remote.sh runs it before every
# migration, and the Deploy workflow every night.
set -eu

dir=$(cd "$(dirname "$0")/../.." && pwd)
backups="$dir/backups"
network=${BACKUP_NETWORK:-nginx-proxy}
keep=${BACKUP_KEEP:-7}
aws_image=${BACKUP_AWS_IMAGE:-amazon/aws-cli:2.22.0}

# A value from an env file, without the quotes around it.
value() {
  sed -n "s/^$1=//p" "$2" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

url=$(value DATABASE_URL "$dir/.env.production")
[ -n "$url" ] || { echo "No DATABASE_URL in $dir/.env.production." >&2; exit 1; }
[ -f "$dir/backup.env" ] || {
  echo "$dir/backup.env is missing: backups go to R2 (README, \"Backups\")." >&2
  exit 1
}
bucket=$(value R2_BUCKET "$dir/backup.env")
account=$(value R2_ACCOUNT_ID "$dir/backup.env")
[ -n "$bucket" ] && [ -n "$account" ] || {
  echo "R2_BUCKET and R2_ACCOUNT_ID must be set in $dir/backup.env." >&2
  exit 1
}

# Postgres tools from the server's own major version: a newer pg_dump can
# write what an older server refuses to restore.
psql_at() { docker run --rm -i --network "$network" "$1" psql -X -At "$url" -c "$2"; }
num=$(psql_at postgres:18-alpine "show server_version_num")
image="postgres:$((num / 10000))-alpine"

mkdir -p "$backups"
chmod 700 "$backups"
name="booking-platform-$(date -u +%Y%m%dT%H%M%SZ).dump"
file="$backups/$name"
check="booking-platform-backup-check-$$"
cleanup() {
  docker rm -f "$check" >/dev/null 2>&1 || true
  rm -f "$file.part"
}
trap cleanup EXIT

echo "Backing up the database ($image)…"
docker run --rm --network "$network" "$image" \
  pg_dump --format=custom --no-owner --no-privileges "$url" >"$file.part"
[ -s "$file.part" ] || { echo "The backup is empty." >&2; exit 1; }

# What the database holds, to compare with the restored copy: its tables,
# and how many rows each has when asked to.
inventory() {
  tables="select schemaname || '.' || relname from pg_stat_user_tables order by 1"
  if [ "${BACKUP_COMPARE_ROWS:-0}" = 1 ]; then
    tables="select format('select %L || '' '' || count(*) from %I.%I', schemaname || '.' || relname, schemaname, relname) from pg_stat_user_tables order by 1"
    printf '%s\n\\gexec\n' "$tables"
  else
    printf '%s;\n' "$tables"
  fi
}
source_inventory=$(inventory | docker run --rm -i --network "$network" "$image" psql -X -At -v ON_ERROR_STOP=1 "$url")

echo "Checking it restores…"
docker run -d --name "$check" -e POSTGRES_PASSWORD=check -e POSTGRES_DB=check "$image" >/dev/null
tries=0
until docker exec "$check" pg_isready -q -h 127.0.0.1 -U postgres -d check 2>/dev/null; do
  tries=$((tries + 1))
  [ "$tries" -lt 60 ] || { echo "The check database didn't start." >&2; exit 1; }
  sleep 1
done
docker exec -i "$check" pg_restore --no-owner --no-privileges --exit-on-error \
  -h 127.0.0.1 -U postgres -d check <"$file.part"
restored_inventory=$(inventory | docker exec -i "$check" psql -X -At -v ON_ERROR_STOP=1 -h 127.0.0.1 -U postgres -d check)
if [ "$source_inventory" != "$restored_inventory" ]; then
  echo "The restored copy differs from the database:" >&2
  printf 'database:\n%s\nrestored:\n%s\n' "$source_inventory" "$restored_inventory" >&2
  exit 1
fi
[ -n "$source_inventory" ] || { echo "The database has no tables: is DATABASE_URL right?" >&2; exit 1; }
mv "$file.part" "$file"

echo "Uploading to R2 ($bucket)…"
key="booking-platform/$name"
size=$(wc -c <"$file" | tr -d ' ')
aws() {
  docker run --rm --env-file "$dir/backup.env" \
    -e AWS_DEFAULT_REGION=auto \
    -e AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    -e AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    -v "$backups:/backups:ro" "$aws_image" \
    --endpoint-url "https://$account.r2.cloudflarestorage.com" "$@"
}
aws s3 cp --only-show-errors "/backups/$name" "s3://$bucket/$key"
uploaded=$(aws s3api head-object --bucket "$bucket" --key "$key" --query ContentLength --output text)
[ "$uploaded" = "$size" ] || {
  echo "R2 holds $uploaded bytes for $key, not $size: the upload is incomplete." >&2
  exit 1
}

echo "$file" >"$backups/latest"
# The newest few stay here; older ones live in R2 only.
ls -1t "$backups"/booking-platform-*.dump | tail -n +"$((keep + 1))" | while read -r old; do rm -f "$old"; done
echo "Backup OK: $name, $size bytes, $(echo "$source_inventory" | wc -l | tr -d ' ') tables restored and checked, in R2."
