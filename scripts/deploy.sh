#!/bin/sh
# yarn deploy: ships the current commit to the server and restarts the app.
#
#   DEPLOY_SSH=user@host DEPLOY_PORT=22 yarn deploy
#
# On the server, DEPLOY_DIR (default: apps/booking-platform; relative to the user's home,
# or absolute, without a tilde) holds
# .env.production, which this never touches, and `src`, the deployed commit.
# On the server (scripts/deploy-remote.sh): build, stop the app, back up the
# database and prove the backup (no backup, no deploy), migrate, start the new
# version. Then the public address (PUBLIC_URL, or DEPLOY_URL) must answer over
# https, or the database and the previous version are put back
# (scripts/rollback-remote.sh).
# Needs git, ssh, tar and curl. See "Deploying" in docs/deployment.md.
set -eu

: "${DEPLOY_SSH:?Set DEPLOY_SSH to user@host}"
port=${DEPLOY_PORT:-22}
dir=${DEPLOY_DIR:-apps/booking-platform}

# Only what is committed is deployed: say so rather than surprise.
if [ -n "$(git status --porcelain)" ]; then
  echo "There are uncommitted changes: they will NOT be deployed." >&2
fi
commit=$(git rev-parse --short HEAD)
echo "Deploying $commit to $DEPLOY_SSH:$dir"

# DEPLOY_SSH_OPTIONS: extra ssh options, such as -S for a shared connection.
# shellcheck disable=SC2086
remote() { ssh -p "$port" ${DEPLOY_SSH_OPTIONS:-} "$DEPLOY_SSH" "$@"; }

remote true || {
  echo "Can't reach $DEPLOY_SSH on port $port." >&2
  exit 1
}
remote "test -f '$dir/.env.production'" || {
  echo "$dir/.env.production is missing on the server: see docs/deployment.md, "Deploying"." >&2
  exit 1
}

# The commit as one file first: a failed archive must not reach the server.
archive=$(mktemp)
trap 'rm -f "$archive"' EXIT
git archive --format=tar -o "$archive" HEAD

# The new source arrives next to the old one, then takes its place.
remote "set -e; cd '$dir'; rm -rf src.new; mkdir src.new; tar -x -C src.new; ln -s ../.env.production src.new/.env.production; rm -rf src.old; if [ -d src ]; then mv src src.old; fi; mv src.new src" <"$archive"

remote "cd '$dir/src' && sh scripts/deploy-remote.sh"

# From outside, as people reach it: DNS, the proxy, the certificate, the app
# and its database. The address is the server's own PUBLIC_URL unless
# DEPLOY_URL says otherwise. No answer within about a minute: roll back.
url=${DEPLOY_URL:-$(remote "sed -n 's/^PUBLIC_URL=//p' '$dir/.env.production'" | tr -d '"\r')}
if [ -z "$url" ]; then
  echo "No PUBLIC_URL in $dir/.env.production and no DEPLOY_URL: can't check the public address." >&2
  exit 1
fi
url=${url%/}

answers() {
  curl -fsS --max-time 10 -o /dev/null "$url/api/health" &&
    curl -fsS --max-time 10 -o /dev/null "$url/"
}

echo "Checking $url…"
tries=0
until answers; do
  tries=$((tries + 1))
  if [ "$tries" -ge 6 ]; then
    echo "$url doesn't answer after the deploy: rolling back." >&2
    remote "cd '$dir/src' && sh scripts/rollback-remote.sh" || true
    if answers; then
      echo "$url answers again, with the previous version. $commit is NOT deployed." >&2
    else
      echo "$url still doesn't answer after the rollback: look at the server now." >&2
    fi
    exit 1
  fi
  sleep 10
done

# Done: nothing left for a rollback to undo in the database, and the commit
# the server runs, which the Deploy workflow compares with the commit the
# nightly checked.
remote "rm -f '$dir/deploy-state'; echo '$(git rev-parse HEAD)' >'$dir/deployed'"
echo "Deployed $commit: $url answers."
