#!/bin/sh
# Runs CI again on the pull requests held while the nightly was red: those
# that merge themselves (Renovate's, and the sync from the starter) and
# failed CI's "Is the nightly green?" step. Called when the `nightly` issue is
# closed, by the nightly itself (nightly.yml) or by a person
# (nightly-closed.yml). Needs gh, with GH_TOKEN and GH_REPO set, and the
# token's actions: write.
set -eu

heads=$(gh pr list --state open --limit 100 --json headRefName,headRefOid \
  --jq '.[] | select((.headRefName | startswith("renovate/")) or .headRefName == "sync-from-starter") | .headRefOid')
if [ -z "$heads" ]; then
  echo "No held pull requests."
  exit 0
fi

for head in $heads; do
  run=$(gh run list --workflow CI --commit "$head" --json databaseId,conclusion \
    --jq '[.[] | select(.conclusion == "failure")][0].databaseId // empty')
  if [ -z "$run" ]; then
    echo "$head: CI didn't fail, nothing to run again."
  elif gh run rerun "$run" --failed; then
    echo "$head: CI runs again (run $run)."
  else
    # GitHub refuses runs older than 30 days: Renovate's next rebase runs CI.
    echo "::warning::Couldn't run CI again for $head (run $run): push to the branch, or wait for Renovate's next rebase."
  fi
done
