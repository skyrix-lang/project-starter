#!/bin/sh
# Checks that a project made from the starter is set up on GitHub: the
# repository settings and ruleset (scripts/setup-github.sh), its secrets, the
# files the sync needs, its place in the starter's STARTER_PROJECTS, Dependabot
# (alerts on, its pull requests off) and Renovate's first run.
# Usage: scripts/check-github.sh <owner/repo>
# Needs `gh`, signed in as an admin of the repository and of the starter.
# Prints one line per check and exits 1 if any fails. Changes nothing.
# The steps behind each check: docs/new-project.md.

repo=${1:?Usage: scripts/check-github.sh <owner/repo>}
starter=skyrix-lang/project-starter
failed=0

ok() { echo "  ok    $1"; }
ko() { echo "  FAIL  $1"; failed=1; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else ko "$1 (is: ${2:-nothing})"; fi; }

echo "$repo"

settings=$(gh api "repos/$repo" --jq '[.allow_auto_merge, .allow_merge_commit, .allow_squash_merge, .allow_rebase_merge, .delete_branch_on_merge] | map(tostring) | join(" ")') || exit 1
check "auto-merge allowed, merge commits only, branches deleted" "$settings" "true true false false true"

rulesets=$(gh api "repos/$repo/rulesets" --jq '[.[] | select(.enforcement == "active") | .name] | join(", ")' 2>/dev/null)
case "$rulesets" in
  *"main: pull requests and green CI"*) ok "ruleset: main needs a pull request and green CI" ;;
  *) ko "ruleset: main needs a pull request and green CI (run scripts/setup-github.sh; a private repository needs GitHub Pro)" ;;
esac

secrets=$(gh secret list -R "$repo" --json name --jq '.[].name')
for secret in STARTER_SYNC_TOKEN CLAUDE_CODE_OAUTH_TOKEN; do
  if echo "$secrets" | grep -qx "$secret"; then ok "secret $secret"; else ko "secret $secret"; fi
done

# The starter has no .starter.json, and lists the projects rather than being
# listed.
if [ "$repo" = "$starter" ]; then project=""; else project=.starter.json; fi

for file in $project renovate.json .github/workflows/ci.yml \
  .github/workflows/sync-from-starter.yml .github/workflows/claude-review.yml \
  .github/workflows/claude.yml; do
  if gh api "repos/$repo/contents/$file" --silent 2>/dev/null; then ok "$file"; else ko "$file on the default branch"; fi
done

projects=$(gh variable get STARTER_PROJECTS -R "$starter" 2>/dev/null)
if [ -z "$project" ]; then
  if [ -n "$projects" ]; then ok "STARTER_PROJECTS: $projects"; else ko "STARTER_PROJECTS variable"; fi
else
  case " $projects " in
    *" $repo "*) ok "listed in $starter's STARTER_PROJECTS" ;;
    *) ko "listed in $starter's STARTER_PROJECTS" ;;
  esac
fi

# Dependabot: alerts on (Renovate reads them), its own pull requests off.
if gh api "repos/$repo/vulnerability-alerts" --silent 2>/dev/null; then ok "Dependabot alerts on"; else ko "Dependabot alerts on"; fi
updates=$(gh api "repos/$repo" --jq '.security_and_analysis.dependabot_security_updates.status // "disabled"')
check "Dependabot security updates off (Renovate opens the fixes)" "$updates" "disabled"
if gh api "repos/$repo/contents/.github/dependabot.yml" --silent 2>/dev/null; then ko "no .github/dependabot.yml (Renovate updates versions)"; else ok "no .github/dependabot.yml"; fi

dashboard=$(gh issue list -R "$repo" --state open --author 'app/renovate' --search 'Dependency Dashboard in:title' --json number --jq 'length')
if [ "${dashboard:-0}" -gt 0 ]; then ok "Renovate has run (Dependency Dashboard issue)"; else ko "Renovate has run (no Dependency Dashboard issue yet: give the app access, then run a scan)"; fi

# What can't be read from here: the secrets' values (a wrong token shows as a
# Claude review failing in about 2 seconds), and which repositories the
# fine-grained token covers (the starter's Notify projects run shows it).
exit "$failed"
