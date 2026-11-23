# Keeping projects up to date with the starter

Projects are made from this starter with `yarn rename`, then grow their own
features. Two mechanisms keep them close to it afterwards:

| What changes                                                  | How it reaches the projects                                     |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| Dependency and image versions                                 | Renovate, in each repository, with the policy in `default.json` |
| Everything else: scripts, CI, Docker, configs, packages, docs | `yarn sync-from-starter`, run in the project when you choose    |

A GitHub workflow runs the sync for you each week and opens a pull request,
with Claude resolving conflicts ("Automatic sync" below). Both are recorded in
`docs/decisions.md` ("Projects follow the starter").

## Versions: Renovate

`default.json`, at the root of the starter, is a
[Renovate preset](https://docs.renovatebot.com/config-presets/): the update
policy for every repository. The starter's `renovate.json` only extends it:

```json
{ "extends": ["github>skyrix-lang/project-starter"] }
```

A project's extends `project.json`, the same policy without major pull
requests (`yarn rename` writes it):

```json
{ "extends": ["github>skyrix-lang/project-starter:project"] }
```

The policy:

- Runs weekly (Monday morning, UTC), and opens a "Dependency Dashboard" issue
  listing what's pending.
- Only versions published at least 7 days ago, as `.yarnrc.yml` requires.
- npm minor and patch updates in one pull request; each major in its own, since
  it may need code changes. GitHub Actions in one pull request.
- Postgres and Keycloak images are updated everywhere they appear:
  `docker/compose.yaml` and the scripts that start them locally
  (`scripts/db-up.sh`, `scripts/keycloak-up.sh`).
- The Node base image digest is updated; Node major versions are never bumped
  (they're chosen on purpose: `.nvmrc`, `docker/Dockerfile`).
- The lockfile is refreshed weekly, for the dependencies of dependencies.
- Everything but majors (minor, patch, digests, the weekly lockfile) merges
  itself, with a merge commit, once the checks `main` requires pass. Majors
  wait for you.
- In a project, majors don't open a pull request: the starter's does, and
  once it's merged the sync brings the new version with the code changes it
  needed, so they're made once rather than in every project. A major for a
  dependency only the project has is listed in its Dependency Dashboard
  issue: tick it to open the pull request. Security fixes, majors included,
  still open theirs at once.
- Security fixes don't wait for Monday: with Dependabot alerts on in the
  repository, Renovate opens a `[SECURITY]` pull request on its next pass,
  which merges itself like any other non-major update. Renovate's default
  for these skips its own 7-day wait, but Yarn's still applies: a fix younger
  than 7 days goes through once it's old enough. Dependabot's own pull
  requests stay off ([new-project.md](new-project.md), step 7).

To change the policy for every project, change `default.json` (or, for
projects only, `project.json`) in the starter and merge it: Renovate reads it from the starter's default branch on its next
run. A project that needs an exception adds rules to its own `renovate.json`,
after the `extends`.

**Setup:** install the [Renovate GitHub app](https://github.com/apps/renovate)
on the starter and on each project's repository, and run
`scripts/setup-github.sh <owner/repo>` once for each ("Auto-merge" below):
without required checks, GitHub would merge an auto-merge pull request before
CI has run. Check the config with
`npx --package renovate renovate-config-validator default.json project.json renovate.json`.

## Everything else: `yarn sync-from-starter`

Run it in a project, on a clean working tree, in a branch:

```bash
git switch -c sync-from-starter
yarn sync-from-starter --dry-run   # the starter's commits and what would change
yarn sync-from-starter             # apply it
yarn format && yarn verify && yarn test
git add -A && git commit -m "Sync from project-starter"
```

### What it does

`.starter.json`, committed in the project, records the starter commit of the
last sync, the project's names, and the paths the project owns:

```json
{
  "slug": "acme-portal",
  "title": "Acme Portal",
  "commit": "50965d53a90f08faa487a84cc550a3421ff46dee",
  "ignore": ["README.md", "packages/feature-bookings/**"]
}
```

For each file the starter changed between that commit and now, it takes three
versions, all with `yarn rename`'s rules applied (`@booking/*` becomes
`@acme-portal/*`, and so on): the starter's file at the last sync, the
starter's file now, and the project's file. Then:

| Situation                                              | Result                                                    |
| ------------------------------------------------------ | --------------------------------------------------------- |
| The project never changed the file                     | replaced by the starter's new version                     |
| Both changed it                                        | merged, like `git merge`; conflicts get `<<<<<<<` markers |
| New in the starter                                     | added                                                     |
| New in the starter, in a workspace the project removed | skipped (`packages/feature-bookings`, for example)        |
| Changed in the starter, deleted in the project         | skipped: the project's deletion stands                    |
| Deleted in the starter, unchanged in the project       | deleted                                                   |
| Deleted in the starter, changed in the project         | kept, and listed                                          |
| Matches a glob in `ignore`                             | skipped                                                   |

`docs/design.md` is the project's own design (the `design` skill writes it):
a project gets the starter's, describing the default brand, as a starting
point on the sync that brings it, and after that it's never changed (nor
restored if the project deletes it). `coverage-minimums.json` works the same
way: the starter's minimums arrive once, and the project sets its own
(docs/development.md, "Coverage"). It never touches
`yarn.lock`: when a `package.json` changed, it runs
`yarn install`, which rewrites it. The sync tooling itself
(`scripts/sync-from-starter.ts`, `scripts/rename.ts`, their tests and this
guide) is always the starter's version, with the starter's names. When the
starter's sync script is newer than the project's, the project's hands off to
it, so a sync always runs with the starter's latest rules. When it's done, `.starter.json` records the new commit.

### Where it reads the starter

In order: `--from <dir>`, then `$STARTER_DIR`, then `../project-starter` (a
sibling checkout), and otherwise a fresh clone of the starter's repository.
It uses the checkout's current commit, so a local starter on a feature branch
syncs that branch: switch it to `main` and pull first, or pass `--ref main`
(`--ref origin/main` after a `git fetch`).

### Conflicts

A conflict means the starter and the project changed the same lines. The script
lists the files and exits with an error; `.starter.json` is updated anyway,
since the rest of the sync is done. Resolve the markers, then
`yarn install` (if a `package.json` was involved), `yarn format`, `yarn verify`.
To give up on the whole sync instead: `git checkout -- . && git clean -fd`.

A file that conflicts on every sync is one the project has made its own,
usually the README: add it to `ignore` and bring in what you want by hand.

Images are files like any other: a new icon or share image in the starter
(`apps/web/public/`) arrives with the starter's brand on it in a project that
has none of its own. Replace it with the project's own, or add its path to
`ignore`. After a change to `index.html`'s JSON-LD, check that the merged
block is still valid JSON.

### Starting with a project made before `.starter.json`

Find the starter commit it was made from (the starter's history around the
project's first commit; the files that differ least), then:

```bash
yarn sync-from-starter --base <commit> [--title "Display Name"] --dry-run
```

The sync script isn't in such a project yet: run the starter's copy from the
project's directory, `yarn tsx ../project-starter/scripts/sync-from-starter.ts --base <commit>`.
It brings the script in.

## Automatic sync

`.github/workflows/sync-from-starter.yml`, which every project receives from
the starter, runs the steps above on GitHub: as soon as something is merged
into the starter's `main` (the starter's `notify-projects.yml` asks each
project listed in its `STARTER_PROJECTS` variable), every Monday at 05:00 UTC,
and whenever you click **Run workflow** in the project's Actions tab.

1. It runs `yarn sync-from-starter` on a `sync-from-starter` branch. If a sync
   pull request is already open, it continues on that branch, so fixes made on
   it are kept.
2. Claude goes over it: resolves any conflicts (keeping the project's choices
   where the two disagree), adapts what came from the starter but is the
   starter's (an example sender, a domain, a name `yarn rename`'s rules don't
   know) to the project, runs `yarn verify`, and explains what it did and what
   it wasn't sure of in the pull request.
3. It opens the pull request, or updates the open one. Conflicts Claude
   couldn't resolve (or with no Claude secret) leave it a draft, listing them.
   If the pull request it continued merged or closed while it ran (a clean
   sync merging itself), it pushes nothing and starts again from the default
   branch instead: the workflow dispatches itself, which needs its
   `actions: write` permission. The workflow file grants it itself, whatever
   the repository's default token permission.
4. A **clean** sync merges itself once CI passes: the starter merged without
   conflicts, Claude's pass succeeded, and `STARTER_SYNC_TOKEN` is set (CI
   doesn't run otherwise). Anything else waits for you to review and merge:
   conflicts, even ones Claude resolved, or no Claude. To review a clean sync
   anyway, click **Disable auto-merge** on its pull request before CI ends.

When the starter has nothing new, it does nothing. In the starter itself (no
`.starter.json`) it does nothing either.

### Setup, once per project repository

The steps in order, for a new project, with a check at the end:
[new-project.md](new-project.md).

- **Settings → Actions → General → Workflow permissions:** "Read and write
  permissions", and tick "Allow GitHub Actions to create and approve pull
  requests".
- **Secret `CLAUDE_CODE_OAUTH_TOKEN`** (Settings → Secrets and variables →
  Actions): run `claude setup-token` in a terminal and paste the token; it
  uses your Claude subscription. Or set `ANTHROPIC_API_KEY` instead, billed to
  an API account. Without either, conflicts are left for you.
- **Secret `STARTER_SYNC_TOKEN`** (recommended): a
  [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
  for the project repositories, with _Contents_, _Pull requests_ and
  _Workflows_ set to read and write. Without it the workflow uses GitHub's
  default token, which has two limits: CI doesn't run on the pull request it
  opens (close and reopen it to start CI), and it can't push a change the
  starter made to a workflow file (the run fails and says so; sync locally).
  Clean syncs only merge themselves with it.
- **Auto-merge:** run `scripts/setup-github.sh <owner/repo>` (needs `gh`,
  signed in as an admin). It allows auto-merge and merge commits only, and
  adds a ruleset on `main`: changes through a pull request, with CI's checks
  and Playwright jobs passing. Safe to run again.

And once, in the starter:

- **Variable `STARTER_PROJECTS`** (Settings → Secrets and variables → Actions →
  Variables): the projects to notify, separated by spaces
  (`owner/acme-portal owner/other`). Add each new project.
- **Secret `STARTER_SYNC_TOKEN`**: the same token, covering those projects.
  Its _Contents_ permission is what lets the starter send them the event.
- **Secret `STARTER_SYNC_TOKEN_2` and variable `STARTER_SYNC_TOKEN_2_OWNER`**
  (only when the projects have two owners, such as your account and an
  organization): a fine-grained token has a single resource owner, so the
  second owner's projects need a second token, with the same permissions,
  made with that owner as resource owner. Set the owner's name in the
  variable: the starter uses `STARTER_SYNC_TOKEN_2` for that owner's projects
  in `STARTER_PROJECTS`, and `STARTER_SYNC_TOKEN` for the others. In such a
  project, its own `STARTER_SYNC_TOKEN` secret is the second owner's token.
  The steps: [new-project.md](new-project.md), "In an organization, private,
  on your own runners".
- `scripts/setup-github.sh` for the starter too, so your own pull requests
  into it merge themselves: `gh pr merge --auto --merge` on a pull request
  (or ask Claude to turn it on).

The workflow runs `yarn sync-from-starter` without `--from`, so it clones the
starter over HTTPS: the starter repository must stay public, or the workflow
needs a token that can read it.

## Claude on GitHub

`.github/workflows/claude-review.yml` reviews every pull request when it's
opened or marked ready (not drafts, not Renovate's): bugs, `AGENTS.md`'s rules,
and the starter and its projects. In the starter, it flags project-specific
values written without the starter's names, which won't be adapted. In a
project, it flags values that still belong to the starter. Findings come as
inline comments, with a summary.

`.github/workflows/claude.yml`, also synced to every project, lets you ask
Claude for work from GitHub itself: mention `@claude` in an issue, a pull
request comment or a review. For example, on a sync pull request:
"@claude the e2e tests fail since this sync, fix them", or in an issue:
"@claude implement this". "@claude review" asks for another review after new
commits. It works on a branch and answers in the thread.
Only people with write access to the repository can trigger it.

Setup, once per repository: install the
[Claude GitHub app](https://github.com/apps/claude) on it, and set the same
`CLAUDE_CODE_OAUTH_TOKEN` (or `ANTHROPIC_API_KEY`) secret. Running
`/install-github-app` in Claude Code in a terminal does both.

## Changing the starter so projects can follow

- **Merge pull requests into the starter with a merge commit**, not squash or
  rebase. Projects record starter commits in `.starter.json`; a squash leaves
  the recorded commit off `main`, and the next sync can't find it.
  `scripts/setup-github.sh` allows only merge commits.
- What's merged into the starter reaches every project within minutes, and
  merges there by itself when it applies cleanly. Merge only what's ready.
- Use the starter's names (`@booking/*`, `booking-platform`, `booking-db`, …)
  in new files, as the existing ones do: `yarn sync-from-starter` and
  `yarn rename` replace them. A new kind of name needs a rule in
  `scripts/rename.ts`, with a test.
- Small, focused commits sync better than large rewrites: a project that edited
  the same file conflicts on less.
- Put project-specific behaviour behind configuration rather than in files
  every project edits, when you can: fewer conflicts on every sync.
