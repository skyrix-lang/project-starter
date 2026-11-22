# Nightly checks, deploy gate and releases

Status: agreed (step a in progress)

## Goal

Changes can reach production without a person reading each one. Every night
the whole suite runs, deeper than on a pull request. The deploy goes ahead
only if that run passes. The version that ships is the one that was tested,
each deploy leaves a release behind, and a failure reaches someone (or Claude)
instead of sitting in the Actions tab.

## Users and access

- **The maintainer** reads the nightly issue and the releases, and approves
  what Claude proposes. They don't need to watch Actions.
- **The workflows** need more permissions than today:
  - the nightly: `issues: write` to open the failure issue;
  - the deploy: `contents: write` to push the release tag and create the
    GitHub Release, and `packages: read` to pull the tested image on the
    runner (step d).
- **Claude**, when a nightly fails, opens a pull request with a fix. It never
  merges it: a fix for a red nightly waits for a person.
- Every project made from the starter (zbeul, platform-booking, relaxason)
  gets this through the sync. Nothing new runs until a project turns it on, as
  with the deploy today (`DEPLOY_SSH`).

## Behaviour

### Today

- `CI` runs on pull requests, `main` and `v*` tags.
- `Deploy` runs at 02:00 Paris time. It deploys `main` if the server doesn't
  run it yet and CI passed on that commit; otherwise it backs up only.
- `CI`'s image job builds and pushes an image on `main`, and signs it on tags.
  Nothing uses that image: the server builds its own (`scripts/deploy-remote.sh`).

### Afterwards

1. **`nightly.yml` runs at 01:30 Paris time.** It uses the same two crons and
   Paris-hour check as `deploy.yml` today, moved into the nightly. It checks
   out `main` and runs:
   - **`CI` itself**, called as a reusable workflow (`workflow_call` added to
     `ci.yml`), so the nightly never drifts from what pull requests run.
   - **Playwright with no retries.** CI retries twice (`playwright.config.ts`),
     which hides flaky tests. The nightly runs with `retries: 0`, so a flaky
     test fails at night instead of passing by luck on a pull request.
   - **Firefox and WebKit**, as extra Playwright projects that only the
     nightly enables. Pull requests keep Chromium only, to stay fast.
   - **A dependency audit**: `yarn npm audit --all --recursive`, failing on
     high and critical advisories. New flaws appear in code that hasn't
     changed, which is something only a scheduled run can catch.
   - **An image scan** of the built image, for flaws in the base image and
     system packages, with Grype (`anchore/scan-action`, pinned by commit).
     It comes with step (d), once that image is the one deployed.
   - **Coverage** of the Vitest suites (`@vitest/coverage-v8`), failing if
     it drops below the committed minimum. The minimum starts at today's
     level and is raised by hand when coverage goes up.

   Every job runs on `vars.RUNNER`, like the rest of CI. On a project's own
   runner the nightly costs no minutes, so it runs in full every night.

2. **The nightly calls the deploy** (`workflow_call` added to `deploy.yml`):
   - it passes the commit it checked (`sha`) and whether every check passed
     (`checks`); the deploy checks out that commit, even if `main` moved on;
   - if anything failed, the deploy job **only backs up**. A red nightly must
     never skip the backup;
   - the deploy keeps its own rules: nothing new on the server means backup
     only, and so does a commit older than the one the server runs (someone
     deployed by hand while the nightly ran);
   - the nightly runs on `main` only, by schedule or by hand: run on another
     branch, it would deploy that branch;
   - a cancelled nightly opens no issue and deploys nothing. On an own
     runner, a pull request's e2e job can take the nightly's place in the
     queue and cancel it.
     `deploy.yml` loses its schedule and keeps "Run workflow", which deploys
     `main` now, whatever the nightly says, as today.
3. **The release is recorded by the deploy.** After `yarn deploy` succeeds,
   the deploy job:
   - tags the deployed commit, for example `v2026.11.22`, or
     `v2026.11.22.2` for a second deploy the same day (by date: a number would need someone to judge each change);
   - creates a GitHub Release with notes generated from the pull requests
     merged since the last release.

   A deploy that fails or rolls back creates nothing. People never tag by
   hand. A tag pushed with the default token starts no workflow, so it doesn't
   start CI again.

4. **The deployed image is the tested one:**
   - CI builds both images the server needs (`runner` and `migrate`) on
     `main`, signs them (cosign, keyless) and pushes them to GitHub's
     registry with their SBOM and provenance;
   - the deploy job, on GitHub's runner, pulls the images CI built for that
     commit by digest, and checks their signatures against this repository's
     CI workflow;
   - it sends them to the server over the SSH connection it already uses
     (`docker save | ssh … docker load`). The server needs no registry token
     and no longer builds;
   - the server continues as today: stop, back up, prove the backup,
     migrate, start, check, roll back on failure;
   - if a signature doesn't check out or the transfer fails, nothing is
     stopped and the deploy fails.
5. **A failed nightly opens one issue.** It's labelled `nightly` and lists
   which jobs failed, with links to their logs:
   - if an issue with that label is already open, the nightly adds a
     comment to it instead of opening another;
   - when a nightly passes, it closes the open issue with a comment.
6. **Claude proposes a fix.** When the nightly fails and a Claude secret is
   set, a last job runs Claude (as `sync-from-starter.yml` does). It reads the
   failed logs, fixes what it can on a `nightly-fix` branch, runs
   `yarn verify`, opens a pull request linked to the issue, and comments on
   the issue with what it did or why it couldn't. Its pull request never
   merges itself.
7. **Auto-merge waits while the nightly is red.** While a `nightly` issue is
   open, CI's `checks` job (already required on `main`) fails on pull
   requests that merge themselves: Renovate's (`renovate/…` branches), and
   the `sync-from-starter` branch. Renovate's security fixes (label
   `security`, set in `default.json`) aren't held: one may be what turns the
   nightly green. Pull requests from people are never held. The required
   check has no bypass, so to merge a held pull request (a sync that fixes
   the nightly) a person closes the issue. Closing it, by hand
   (`nightly-closed.yml`) or on a green night, runs CI again on the held pull
   requests (`scripts/rerun-held.sh`).

### Failures

| What fails                                 | What happens                                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Any nightly job                            | No deploy, backup only, the issue is opened or updated, Claude tries a fix.                                        |
| The audit, on a flaw with no fixed version | The same: the issue says which package. Ignoring an advisory is a committed, dated exception, never a silent skip. |
| The deploy, after a green nightly          | As today: rollback, no tag, no release. The issue is opened too, so a failed deploy is seen.                       |
| Claude's fix                               | Its pull request goes through CI like any other. If Claude can't fix it, it says why on the issue.                 |
| GitHub starts the nightly late             | The Paris-hour check works from the cron that fired, as `deploy.yml` does today.                                   |
| No `DEPLOY_SSH`                            | The nightly still runs its checks and opens issues. It just doesn't deploy.                                        |

## Data

No database change. New in each repository:

- a `nightly` issue label (created by the nightly the first time it fails);
- `v<date>` tags and GitHub Releases;
- images in GitHub's registry, which already exist today.

Every `package.json` version goes to `0.0.0`: they're never published, and
the release tag is the version. `/api/health` doesn't report a version: the
release, the server's `deployed` file and the image's revision label already
say what runs.

## Pages and API

No page change. Workflows and scripts:

- `.github/workflows/nightly.yml` (new): the schedule, the extra checks, the
  call to the deploy, the issue and Claude's fix.
- `.github/workflows/ci.yml`: adds `workflow_call`, an input for the extra
  browsers and no retries, and both images built on `main`.
- `.github/workflows/nightly-closed.yml` (new) and `scripts/rerun-held.sh`:
  CI again on the held pull requests when the issue is closed.
- `default.json`: the `security` label on Renovate's security fixes.
- `.github/workflows/deploy.yml`: adds `workflow_call` with `sha` and
  `checks` inputs and loses its schedule. It also gains the tag and release step, and
  passes the image digest.
- `scripts/deploy.sh`, `scripts/deploy-remote.sh`: pull and check the image
  instead of building it (step d).
- `scripts/check-github.sh`: lists `nightly.yml` and `nightly-closed.yml`. The required checks
  don't change: the nightly doesn't run on pull requests, so it can't be a
  required check.
- Docs: `docs/auto-deploy.md`, `docs/deployment.md`, `docs/development.md`
  ("CI"), `AGENTS.md`, `docs/new-project.md`, and
  `docs/decisions.md` (a new decision, and the one on building on the server
  revised if option A is chosen).

## Out of scope

- **Renaming `ci.yml` to `verify.yml`.** The deploy finds CI by its name,
  and every project would get the rename for no gain.
- **Deploying on every merge.** Deploys stay at night, when stopping the app
  makes the backup exact (`docs/decisions.md`). "Run workflow" covers urgent
  cases.
- **Trying the migration on a copy of the production database first.** The
  deploy already migrates right after a proven backup, and restores it if
  the migration fails. A dry run would add a second restore every night for
  little gain. It never runs on a CI runner either way: production data
  stays on the server.
- **Tests against production after the deploy** beyond today's health and
  home page check.
- **Mutation testing** (Stryker). Worth a spec of its own once coverage is
  in place.
- **Notifications outside GitHub** (mail, chat). The issue notifies whoever
  watches the repository.

## Tests

Workflows can't be tested by Playwright. Each is checked by a run, and the
scripts have tests where they hold logic:

- `nightly passes: the deploy deploys main and creates a release`
- `nightly fails: the deploy only backs up, and one issue is opened`
- `nightly fails twice: the same issue gets a comment, not a new one`
- `nightly passes after a failure: the issue is closed`
- `nightly fails, Claude set: a nightly-fix pull request is opened and not auto-merged`
- `flaky test: passes with retries in CI, fails in the nightly` (made flaky
  once on a branch, to see it)
- `audit: a known-vulnerable version fails the nightly` (pinned once on a
  branch, then removed)
- `deploy by hand: deploys whatever the nightly said`
- `deploy: an image with no valid signature stops nothing and fails`
- `deploy: the release tag is v<date>, then v<date>.2 the same day`
- `release tag pushed: CI does not start`
- `sync with a nightly issue open: does not merge itself`
- each project after the sync: `scripts/check-github.sh <owner/repo>`
  passes, and one nightly runs green.

## Decisions

Agreed on 2026-11-22.

1. **Order of work:** (a) the nightly, the gate, the issue, coverage and the
   hold on auto-merge; (b) the release; (c) Claude's fix; (d) deploying the
   CI image, with the image scan. Each step syncs to the projects on its own.
2. **Image:** the CI image is deployed, sent over SSH from the runner, so the
   server needs no registry. The decision "Building on the server needs no
   registry" in `docs/decisions.md` is updated in step (d).
3. **Tags:** by date, `v2026.11.22`, then `v2026.11.22.2` the same day.
4. **Coverage:** added now, with a minimum that only goes up.
5. **A red nightly holds auto-merge,** for bot pull requests only.
6. **No version in `/api/health`.**
7. **Image scan:** Grype, in step (d). The dependency audit covers step (a).
8. **Runners:** `vars.RUNNER`, like every job. The docs give the one command
   that installs Firefox's and WebKit's libraries on an own runner.
9. **Cost:** the private repositories run on the maintainer's own runner, so
   the nightly runs in full every night.
