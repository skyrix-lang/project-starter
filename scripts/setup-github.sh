#!/bin/sh
# Sets up a GitHub repository (the starter or a project) so pull requests can
# merge themselves once CI passes:
# - auto-merge allowed, merge commits only (a squash or rebase loses the
#   starter commits projects record in .starter.json), branches deleted after
#   merging;
# - a ruleset on the default branch: changes only through a pull request (no
#   approval needed), and CI's checks and e2e jobs must pass.
# Usage: scripts/setup-github.sh [owner/repo]   (default: this checkout's repo)
# Needs `gh`, signed in as an admin of the repository. Safe to run again.
set -e

repo=${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}

gh api -X PATCH "repos/$repo" --silent \
  -F allow_auto_merge=true \
  -F allow_merge_commit=true \
  -F allow_squash_merge=false \
  -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true

# The check names are the job names in .github/workflows/ci.yml.
ruleset=$(cat <<'EOF'
{
  "name": "main: pull requests and green CI",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false,
        "allowed_merge_methods": ["merge"]
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Format, types, lint, boundaries, API contract and unit tests" },
          { "context": "Playwright (with axe)" }
        ]
      }
    }
  ]
}
EOF
)

name=$(printf '%s' "$ruleset" | jq -r .name)
id=$(gh api "repos/$repo/rulesets" --jq ".[] | select(.name == \"$name\") | .id")
if [ -n "$id" ]; then
  printf '%s' "$ruleset" | gh api -X PUT "repos/$repo/rulesets/$id" --input - --silent
else
  printf '%s' "$ruleset" | gh api -X POST "repos/$repo/rulesets" --input - --silent
fi

echo "$repo: auto-merge allowed, merge commits only, main needs a pull request and green CI."
