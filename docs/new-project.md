# Starting a new project from the starter

Every step to go from nothing to a project that follows the starter by
itself: its code, its GitHub repository, auto-merge, CI, Claude, Renovate and
the starter sync. When it's done, you only work on branches: pull requests
merge themselves once CI passes, Renovate keeps versions current, and what's
merged into the starter reaches the project within minutes.

Each step says who does it:

- **Claude**: a command Claude can run for you.
- **You**: needs your browser, an account, or a secret Claude must never see.

## Ask Claude to do it

In a Claude Code session in `project-starter` (or a folder that holds it),
say:

> Set up a new project from the starter, following docs/new-project.md:
> slug `acme-portal`, title "Acme Portal", public repository.

Claude runs the **Claude** steps and stops at each **You** step with what to
do. At the end it runs `scripts/check-github.sh` and reports what's missing.

## What you need

- `gh`, signed in as the owner of the repositories (`gh auth status`), Node
  24 with Corepack, Docker.
- A checkout of the starter at `~/Workspace/project-starter`, on `main`, up to
  date (`git switch main && git pull`).
- Done once, already in place for the existing projects (see "Once, for every
  project" at the end): the `STARTER_SYNC_TOKEN` token, a Claude token, and the
  Renovate and Claude GitHub apps installed on your account.

## 1. Make the code (Claude)

From a fresh clone of the starter, so the rename starts from its latest
commit, which `.starter.json` records:

```bash
cd ~/Workspace
git clone https://github.com/skyrix-lang/project-starter.git acme-portal
cd acme-portal
yarn install
yarn rename acme-portal "Acme Portal"
```

Then give it its own history, starting from the renamed code:

```bash
rm -rf .git
git init -b main
git add -A
git commit -m "Initial commit: acme-portal, from project-starter"
```

Then, as `yarn rename` says at the end: `rm -f .env && yarn setup`,
`yarn verify && yarn test`. Still yours to write: the description in
`package.json`, and the site's description, logo and metadata in
`apps/web/index.html` and `packages/core/src/site.ts`.

## 2. Create the repository and push (Claude, after you say yes)

```bash
gh repo create skyrix-lang/acme-portal --public --source . --push
```

**Public or private?** Auto-merge needs `main` to require CI, and GitHub Free
offers that (rulesets) on public repositories only. On a private repository
you need GitHub Pro (or a Team organization); without it everything else
works, but sync pull requests wait for you to merge them (the sync workflow
checks, and never turns auto-merge on where `main` requires no checks).

## 3. Repository settings (Claude)

```bash
~/Workspace/project-starter/scripts/setup-github.sh skyrix-lang/acme-portal
```

It allows auto-merge, merge commits only (a squash would lose the starter
commits `.starter.json` records), deletes merged branches, and adds a ruleset
on `main`: changes only through a pull
request, with CI's checks and Playwright jobs passing. Without required
checks, GitHub would merge an auto-merge pull request before CI has run.
Safe to run again.

## 4. Secrets (You)

Claude must never see these values: you paste them, `gh` sends them.

1. **Add the repository to the `STARTER_SYNC_TOKEN` token.** It's a
   fine-grained token covering only the repositories you picked:
   [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens)
   → the token → **Edit** → Repository access → add `acme-portal` → Save.
   Its value doesn't change.
2. **Set both secrets** in the new repository. Each command asks you to paste
   the value. Paste the token alone: an extra line or space breaks it.

   ```bash
   gh secret set STARTER_SYNC_TOKEN -R skyrix-lang/acme-portal
   ```

   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN -R skyrix-lang/acme-portal
   ```

   GitHub never shows a secret again. If you didn't keep the values: a new
   fine-grained token, or `claude setup-token` for a new Claude token
   (`sk-ant-oat…`, about a year). Then update every repository that uses it.

What they do: `STARTER_SYNC_TOKEN` lets the sync workflow open pull requests
that run CI (and push changes to workflow files), and lets the starter send
the project its "sync now" signal. `CLAUDE_CODE_OAUTH_TOKEN` runs Claude on
your subscription: the review on every pull request, `@claude`, and the pass
over each sync. Without it no sync counts as clean, so none merges itself.

## 5. Tell the starter about it (Claude)

Add the repository to the starter's `STARTER_PROJECTS` variable, the list the
starter notifies when its `main` changes:

```bash
current=$(gh variable get STARTER_PROJECTS -R skyrix-lang/project-starter)
gh variable set STARTER_PROJECTS -R skyrix-lang/project-starter \
  --body "$current skyrix-lang/acme-portal"
```

## 6. Renovate and Claude apps (You)

- **Renovate:** [github.com/settings/installations](https://github.com/settings/installations)
  → Renovate → **Configure** → Repository access → add `acme-portal`. Then on
  [developer.mend.io](https://developer.mend.io) → skyrix-lang → acme-portal,
  click **Run Renovate scan**. Its first run opens the "Dependency Dashboard"
  issue. Nothing to add to the repository: `renovate.json` came with the
  starter.
- **Claude:** if the Claude GitHub app is installed for selected repositories
  only, add `acme-portal` the same way (Claude → **Configure**). If it's
  installed for all repositories, there's nothing to do.

## 7. Security alerts and notifications (You)

- **Dependabot alerts: on.** Repository → **Settings → Advanced Security**
  (or "Code security") → **Dependabot alerts → Enable**. Or, from a terminal:

  ```bash
  gh api -X PUT repos/skyrix-lang/acme-portal/vulnerability-alerts
  ```

  GitHub then lists known vulnerabilities in the **Security** tab, and
  Renovate sees them: it opens a `[SECURITY]` pull request for each, on its
  next pass (within hours, not on Monday), which merges itself once CI passes.
  A fix published less than 7 days ago waits until it's 7 days old
  (`.yarnrc.yml`), on purpose.

- **Dependabot security updates: leave off**, and don't add a
  `.github/dependabot.yml`. Renovate is the only bot opening pull requests:
  Dependabot's would duplicate Renovate's, ignore `default.json` (the 7-day
  wait, merge commits), get no secrets (the Claude review fails) and wait for
  you to merge them.
- **Not too many notifications** (once for your account, already done):
  [github.com/settings/notifications](https://github.com/settings/notifications)
  → **Dependabot alerts** → "Email weekly digest" (or GitHub only). Most
  alerts are already fixed and merged when you read it; the digest still shows
  one that's stuck (a major update, or no fix yet). To hear only about pull
  requests that need you, set the repository's **Watch** menu to
  "Participating and @mentions".

## 8. Check (Claude)

```bash
~/Workspace/project-starter/scripts/check-github.sh skyrix-lang/acme-portal
```

Every line should say `ok`. Renovate's line can stay `FAIL` until its first
scan has run. Then try the whole chain once:

1. **The starter's signal:** run the starter's **Notify projects** workflow
   (`gh workflow run notify-projects.yml -R skyrix-lang/project-starter`). Its
   log says "Asked skyrix-lang/acme-portal to sync", and the project's **Sync
   from starter** workflow runs: "Nothing new in the starter".
2. **A pull request:** open a small one (a README line). CI and the Claude
   review run; turn on auto-merge (`gh pr merge --auto --merge`, or ask Claude)
   and it merges itself once CI passes.

## When something doesn't work

| Symptom                                           | Cause, and the fix                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Claude review fails in about 2 seconds        | The Claude token is wrong (often an extra line pasted with it): set it again, then re-run the job.                                                                      |
| The Claude review doesn't run                     | The pull request was opened as a draft: close and reopen it, or comment `@claude review`. Renovate's pull requests are skipped on purpose.                              |
| CI doesn't run on a sync pull request             | `STARTER_SYNC_TOKEN` is missing: pull requests opened with GitHub's default token don't run workflows.                                                                  |
| The sync fails on a workflow file                 | Same: the default token can't push workflow changes.                                                                                                                    |
| Notify projects: "Couldn't reach" a repository    | The token doesn't cover that repository (step 4.1).                                                                                                                     |
| A clean sync doesn't merge itself                 | `main` requires no checks (step 3; on a private repository, GitHub Pro), or auto-merge isn't allowed. The run's warning says which.                                     |
| A sync pull request is a draft                    | Conflicts Claude couldn't resolve: fix the `<<<<<<<` markers on its branch, push, mark it ready.                                                                        |
| No Dependency Dashboard                           | Renovate can't see the repository, or hasn't run yet (step 6).                                                                                                          |
| `gh pr merge --auto`: "auto-merge is not allowed" | Step 3 wasn't run on this repository.                                                                                                                                   |
| A vulnerability alert gets no pull request        | Dependabot alerts are off (step 7), Renovate hasn't run since, the fix is a major update (waits for you, on the Dependency Dashboard), or there's no fixed version yet. |
| Pull requests from Dependabot                     | Dependabot security updates are on, or a `.github/dependabot.yml` exists: turn them off and delete it (step 7), and close its pull requests.                            |

## Once, for every project

Already done; here for when a token expires or you start over.

- **`STARTER_SYNC_TOKEN`:** a
  [fine-grained personal access token](https://github.com/settings/personal-access-tokens/new),
  resource owner `skyrix-lang`, repository access "Only select repositories"
  (the starter and every project), with _Contents_, _Pull requests_ and
  _Workflows_ set to read and write. Set it in the starter and in every
  project. When it expires, syncs stop opening pull requests: make a new one
  and update it everywhere.
- **`CLAUDE_CODE_OAUTH_TOKEN`:** `claude setup-token`, set in the starter and
  every project. When it expires, reviews fail in seconds and no sync is clean.
- **The starter itself:** `scripts/setup-github.sh skyrix-lang/project-starter`,
  the `STARTER_PROJECTS` variable, and both secrets.
- **Apps:** [Renovate](https://github.com/apps/renovate) and
  [Claude](https://github.com/apps/claude) installed on your account.
- **Notifications:** Dependabot alerts as a weekly digest (step 7).

How the sync and Renovate work: [starter-sync.md](starter-sync.md).
