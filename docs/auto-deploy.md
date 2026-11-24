# Deploying a project automatically

How to make a project made from the starter deploy itself to a server (a VPS
with Docker) every night around 02:00, with its database backed up first.
With auto-merge on ([new-project.md](new-project.md)), the whole chain runs on
its own: a pull request merges once CI passes; that night, the nightly runs
every check on `main` (development.md, "The nightly") and, if they all pass,
the deploy backs the
database up to a Cloudflare R2 bucket and proves the backup restores, then
migrates, starts the new version and checks the public https address. If
anything fails, the previous version **and its data** stay or are put back,
and a `nightly` issue says what failed. Nights with nothing new, or with a
failed check, it backs up all the same.

**Everything ships with the starter, switched off.** `scripts/deploy.sh`
(`yarn deploy`), `scripts/deploy-remote.sh`, `scripts/rollback-remote.sh`,
`scripts/backup-remote.sh`, `scripts/restore-remote.sh`,
`scripts/migrations-remote.sh`, `docker/compose.production.yaml`,
`docker/backup.env.example` and `.github/workflows/deploy.yml` are in every
project, renamed by `yarn rename`. The workflow does nothing until the
project sets the `DEPLOY_SSH` variable, so the starter itself and projects
that don't deploy never do. Turning it on is configuration only: a server, an
R2 bucket, a key, two secrets and a variable. No code changes. `zbeul` was
the first project to use it.

Each step says who does it:

- **Claude**: a command or a change Claude can make for you.
- **You**: needs your server, your browser, or a secret Claude must never see
  (the private key).

Placeholders, to replace with yours: `acme-portal` the project, `<server>`
the server's address, `<user>` the account that deploys on it, `<port>` its
SSH port.

## Ask Claude to do it

In a Claude Code session in the project, say:

> Set up automatic deploys following the starter's docs/auto-deploy.md.

Claude does the **Claude** steps and stops at each **You** step with what to
run. Give it the server's address and SSH port only when a step needs them:
they go in variables, never in a committed file.

## How it works

```
every night, 01:13 Paris ─▶ Nightly: CI in full and an audit, on main's commit
                             │ then, around 02:00
                             ▼
                           Deploy workflow (SSH, a key for this only, host key pinned)
                             │
         that commit new on the server and every check passed?
              │ no                                   │ yes
              ▼                                      ▼
     back up the database              yarn deploy: copy the commit, build the image
                                       (old version still serving), stop the app,
                                       back up + prove the backup ── fails ─▶ old version
                                              │                             starts again,
                                              ▼                             nothing migrated
                                       migrate, start, health check,
                                       check https://<site>/api/health and /
                                              │ fails
                                              ▼
                                       rollback: restore the database (if a
                                       migration ran), start the previous image
```

- **When:** the `Nightly` workflow starts at 01:13. GitHub's cron is UTC
  only, so two crons (`13 23 * * *` and `13 0 * * *`) run; a first job keeps
  the one that is 01:13 in `Europe/Paris` that day (summer or winter time).
  The deploy starts once its checks are done, between about 01:45 and 02:15,
  when nobody uses the app and stopping it for about a minute costs nothing.
- **What:** the commit the nightly checked (`main` when it started, even if
  `main` moved on since) is deployed if the server doesn't run it yet (the
  server keeps the deployed commit in `DEPLOY_DIR/deployed`) and every check
  passed, and it includes what the server runs (never an older commit, if
  someone deployed by hand in the meantime; a commit `main`'s history doesn't
  know, such as a deploy from a local commit, is replaced). Otherwise the night only backs
  up. A cancelled nightly deploys nothing either. **Run workflow** on the Deploy
  workflow deploys `main` at once, whatever the hour and the nightly.
- **The backup** (`scripts/backup-remote.sh`): `pg_dump` with the server's
  Postgres version, restored into a throwaway Postgres whose tables (and,
  before a deploy, every table's row count) must match the database, then
  uploaded to R2, whose copy must have the same size. The last 7 also stay on
  the server in `DEPLOY_DIR/backups`.
- **One at a time:** a newer run waits for the one in progress, and is never
  cancelled in the middle of a migration.
- **Secrets:** in a GitHub **environment** called `production`, limited to
  `main`, so only a job deploying `main` can read them. The R2 key stays on
  the server, never in GitHub.
- **Off switch:** the workflow does nothing until the `DEPLOY_SSH`
  repository variable is set. Delete it to pause deploys and backups.
- **What fails, and what's left running:**

  | Fails                                   | Result                                                                 |
  | --------------------------------------- | ---------------------------------------------------------------------- |
  | the build                               | stops there: the old version was never stopped                         |
  | the backup, its check or the upload     | the old version starts again; nothing was migrated                     |
  | a migration                             | rollback: the database is restored, the previous image starts          |
  | the new container's health check        | rollback: database restored if a migration ran, previous image started |
  | the public address (DNS, proxy, https…) | the same rollback, then the address checked again                      |

  Each deploy keeps the version it replaces as `<slug>-app:previous`; the
  running one is `<slug>-app:current`. The deploy writes
  `DEPLOY_DIR/deploy-state` (which backup, and how many migrations the
  database had applied) before migrating; the rollback restores the database
  only if that count changed, so a failed release that didn't migrate loses
  no data. The app stays stopped from the backup until the end, so a restore
  loses nothing either. A successful deploy deletes `deploy-state`.

## 1. The project can deploy by hand (Claude, then You)

Automatic deploys run the project's own `yarn deploy`, so that must work
first, from your machine.

- **Claude:** check the project has the files listed above and a `deploy`
  script in `package.json`, with the project's slug in place of
  `booking-platform` (image `<slug>-app:current`, compose `name: <slug>`,
  default `DEPLOY_DIR` `apps/<slug>`, R2 folder `<slug>/`). A project made
  before they existed gets them with `yarn sync-from-starter` (or the next
  automatic sync). Nothing else to change unless the server differs:
  - another proxy network than `nginx-proxy`: the `networks:` of
    `docker/compose.production.yaml`, and `BACKUP_NETWORK` (read by the
    backup, restore and migration-count scripts);
  - another time zone or hour than 02:00 Paris: step 2.

  What the scripts guarantee, so a change keeps it:
  - `scripts/deploy.sh` needs only `git`, `ssh`, `tar` and `curl` (no Node,
    no Yarn); reads `DEPLOY_SSH`, `DEPLOY_PORT`, `DEPLOY_DIR`, `DEPLOY_URL`
    and `DEPLOY_SSH_OPTIONS`; ends with the public check (`/api/health` and
    `/` over https at `DEPLOY_URL`, or the server's `PUBLIC_URL`, for about a
    minute), then the rollback and a failed exit. On success it deletes
    `deploy-state` and writes the commit to `DEPLOY_DIR/deployed`.
  - `scripts/deploy-remote.sh`, in this order: tag the running image
    `<slug>-app:previous`; build `app` and `migrate`; stop the app; back up
    with `BACKUP_COMPARE_ROWS=1` (on failure: start the old app, exit 1);
    write `deploy-state`; migrate and `compose up -d --wait app`, running the
    rollback when either fails. Its prune removes untagged images only.
  - `scripts/rollback-remote.sh` restores the database only when
    `deploy-state` exists and the migration count changed (and starts the
    previous image even if the restore fails, saying so loudly); then tags
    `previous` as `current`, recreates the app and deletes `deploy-state`.
  - `scripts/restore-remote.sh` stops the app and restores in **one
    transaction** (dropping the `drizzle` and `public` schemas first), so a
    failed restore leaves the database as it was.

- **You:** on the server, the one-time setup in the "Deploying" section of
  [deployment.md](deployment.md): Docker, the proxy, a database whose user **owns** it, and
  `.env.production` (the production values of `.env.example`, including its
  "Production" section):

  ```bash
  mkdir -p ~/apps/acme-portal && install -m 600 /dev/null ~/apps/acme-portal/.env.production && nano ~/apps/acme-portal/.env.production
  ```

  Then step 6 (R2): without `backup.env`, every deploy stops at the backup
  with the old version running. Then one deploy by hand:

  ```bash
  DEPLOY_SSH=<user>@<server> DEPLOY_PORT=<port> yarn deploy
  ```

  If this doesn't work, stop here: GitHub would only fail the same way,
  with less to see.

## 2. The workflow (Claude, only to change it)

`.github/workflows/deploy.yml` and `.github/workflows/nightly.yml` are
already there and need no change for 02:00 Paris time. How they work, for
when they must change:

- the nightly has `on: schedule` with two crons, `"13 23 * * *"` and
  `"13 0 * * *"` (GitHub's clock is UTC), and `workflow_dispatch`. Its first
  job, `when`, outputs `go=true` for a manual run, or when
  `github.event.schedule` is the cron that is 01:13 in Paris today
  (`TZ=Europe/Paris date +%z` is `+0200`: `"13 23 * * *"`, otherwise
  `"13 0 * * *"`). **Another time zone or hour:** change both crons and that
  test together;
- after its checks, the nightly calls `deploy.yml` (`workflow_call`) with the
  commit it checked (`sha`) and whether they all passed (`checks`), and
  `secrets: inherit`. The deploy also has `workflow_dispatch`, for a deploy
  by hand;
- `concurrency: { group: deploy, cancel-in-progress: false }`: never
  cancelled in the middle of a migration;
- the `deploy` job (`if: vars.DEPLOY_SSH != ''`, the off switch;
  `environment: production`; checkout of the nightly's commit, or `main` by
  hand) writes the key and `known_hosts` from the secrets, then decides: a
  manual run deploys; a nightly one deploys only if the server's
  `DEPLOY_DIR/deployed` isn't that commit and `checks` is `success`, and
  otherwise only runs `scripts/backup-remote.sh` over ssh;
- a last step, `if: always()`, deletes the key.

The only per-project setting is `DEPLOY_DIR`'s default (`apps/<slug>`), set
by `yarn rename`. Merging changes deploys nothing until `DEPLOY_SSH` is set.

## 3. A key for GitHub only (You)

On your machine. No passphrase, since nobody is there to type it; the
private key leaves your machine only into the secret in step 5:

```bash
ssh-keygen -t ed25519 -N "" -C "acme-portal deploy from GitHub" -f ~/.ssh/acme-portal_deploy
```

Allow it on the server, for the account that deploys (it needs Docker and
the deploy folder, nothing more):

```bash
ssh-copy-id -i ~/.ssh/acme-portal_deploy.pub -p <port> <user>@<server>
```

Check it logs in with that key alone:

```bash
ssh -i ~/.ssh/acme-portal_deploy -o IdentitiesOnly=yes -p <port> <user>@<server> true && echo ok
```

## 4. The `production` environment (You)

Repository → **Settings → Environments → New environment** → `production`.

- **Deployment branches and tags:** "Selected branches and tags" → add
  `main`.
- **Required reviewers:** only if you want to approve each deploy. Without
  it, every merge that passes CI goes live, Renovate's updates and the
  starter's clean syncs included.

## 5. Secrets and variables (You)

The secrets go in the environment. Each command reads the value from a file
or a command, so it never shows on screen.

The private key:

```bash
gh secret set DEPLOY_SSH_KEY --env production -R skyrix-lang/acme-portal < ~/.ssh/acme-portal_deploy
```

The server's host key, pinned. **Use the server's real SSH port here:** on the
wrong one, `ssh-keyscan` gets no answer and saves an empty secret.

```bash
ssh-keyscan -p <port> <server> | gh secret set DEPLOY_KNOWN_HOSTS --env production -R skyrix-lang/acme-portal
```

Before trusting it, compare what the server answers with what your machine
already trusts. The fingerprints must be the same:

```bash
ssh-keyscan -p <port> <server> 2>/dev/null | ssh-keygen -lf -
```

```bash
ssh-keygen -l -F "[<server>]:<port>"
```

(For port 22, the second command is `ssh-keygen -l -F <server>`.)

The variables. **`DEPLOY_SSH` must be a repository variable, not an
environment one:** the job reads it in its `if:`, before the environment is
loaded, so an environment variable there is never seen and every run is
skipped.

```bash
gh variable set DEPLOY_SSH -R skyrix-lang/acme-portal --body "<user>@<server>"
```

`DEPLOY_PORT` (if not 22) and `DEPLOY_DIR` (if not `apps/<slug>`) are
variables too, not secrets: a port isn't secret, and `vars.` can't read a
secret. Either level works for them, since a step reads them after the
environment is loaded; set each at one level only.

```bash
gh variable set DEPLOY_PORT --env production -R skyrix-lang/acme-portal --body "<port>"
```

What goes where:

| Name                 | Kind     | Level               | Holds                             |
| -------------------- | -------- | ------------------- | --------------------------------- |
| `DEPLOY_SSH_KEY`     | secret   | environment         | the private key                   |
| `DEPLOY_KNOWN_HOSTS` | secret   | environment         | the server's host keys            |
| `DEPLOY_SSH`         | variable | **repository**      | `<user>@<server>`; the off switch |
| `DEPLOY_PORT`        | variable | environment or repo | the SSH port, if not 22           |
| `DEPLOY_DIR`         | variable | environment or repo | the deploy folder, if not default |

## 6. Backups to Cloudflare R2 (You, then Claude)

R2 has no egress fees and speaks the S3 API; the server uploads with the
`amazon/aws-cli` image, so nothing is installed there.

**You**, in the Cloudflare dashboard:

1. R2 → **Create bucket**: `acme-portal-backups`, location automatic.
2. The bucket's Settings → **Object lifecycle rules** → add a rule deleting
   objects after 30 days (how long you keep backups). Optionally, **Bucket
   lock rules** keep each backup from being deleted or replaced for a few
   days, even by someone holding the key.
3. R2 → **Manage API tokens** → **Create API token**: permission **Object
   Read & Write**, applied to **that bucket only**. Keep the Access Key ID
   and the Secret Access Key (shown once), and your account ID (in the S3
   endpoint, `https://<account id>.r2.cloudflarestorage.com`).

**You**, on the server, next to `.env.production` (Claude never sees the
key):

```bash
install -m 600 /dev/null apps/acme-portal/backup.env && nano apps/acme-portal/backup.env
```

```bash
R2_ACCOUNT_ID=<account id>
R2_BUCKET=acme-portal-backups
AWS_ACCESS_KEY_ID=<access key id>
AWS_SECRET_ACCESS_KEY=<secret access key>
```

**Claude** (or You), once a deploy has copied the scripts to the server, a
first backup:

```bash
ssh -p <port> <user>@<server> 'cd apps/acme-portal/src && sh scripts/backup-remote.sh'
```

It ends with `Backup OK: <slug>-<date>.dump, … tables restored and checked,
in R2.`, and the file appears in the bucket under `<slug>/`.

## 7. First deploy (You, then Claude)

**You:** Actions → **Deploy** → **Run workflow** on `main`, or:

```bash
gh workflow run deploy.yml -R skyrix-lang/acme-portal --ref main
```

**Claude:** check the run. A good one shows `Backup OK`, the migrations
applied, the app container `Healthy`, and `Deployed <commit>: https://…
answers`:

```bash
id=$(gh run list -R skyrix-lang/acme-portal --workflow deploy.yml -L 1 --json databaseId --jq '.[0].databaseId')
gh run view "$id" -R skyrix-lang/acme-portal --log | grep -E "Backup|migrations|Healthy|Deployed|answer|Rolled back|restor|error"
```

The public check uses the site's `PUBLIC_URL` from the server's
`.env.production`. To check another address (a different domain in front, or
a path that must answer), set the `DEPLOY_URL` variable, like `DEPLOY_PORT`.

**Try the rollback once** (You, optional, on a quiet moment): from your
machine, on an up-to-date `main` with nothing uncommitted, run the same check against an address that doesn't answer. It
deploys, finds no answer, and puts the previous version back:

```bash
DEPLOY_SSH=<user>@<server> DEPLOY_PORT=<port> DEPLOY_URL=https://nothing.invalid yarn deploy
```

It ends with "rolling back", "No migration ran" (or "restoring the
database", if the release had a migration), "Rolled back" and "still doesn't
answer" (the fake address never answers): the site itself is back on the
previous version. Then **Run workflow** once to deploy `main` again.

The next scheduled runs: Actions → Nightly shows one run at 23:13 and one at
00:13 UTC each night; the one that isn't 01:13 in Paris stops after its first
job, skipping the rest. That's expected.

## When something doesn't work

| Symptom                                                 | Cause, and the fix                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Deploy job is **skipped**                           | On one of the two nightly runs, expected: that one isn't 01:13 in Paris. On both, or on Run workflow: `DEPLOY_SSH` is missing at the **repository** level (often set on the environment instead): move it (step 5).                                                                     |
| "The nightly failed on …: not deploying tonight"        | A nightly check failed: the night only backed up, and the `nightly` issue says which. Fix on a branch and merge; it deploys the next night (or Run workflow).                                                                                                                           |
| "backup.env is missing" / "The backup failed"           | Step 6 isn't done, or the R2 key, bucket or account ID is wrong: the old version runs again and nothing was migrated. Run the backup by hand (step 6) to see why.                                                                                                                       |
| "R2 holds … bytes … the upload is incomplete"           | The upload to R2 broke: nothing deployed. Usually a network hiccup; Run workflow again.                                                                                                                                                                                                 |
| "THE DATABASE RESTORE FAILED"                           | The rollback couldn't restore (the previous version runs on the migrated database). Restore by hand ("Day to day"), now.                                                                                                                                                                |
| "Set the DEPLOY_SSH_KEY and DEPLOY_KNOWN_HOSTS secrets" | One is empty or not in the `production` environment. An empty `DEPLOY_KNOWN_HOSTS` usually means `ssh-keyscan` ran on the wrong port.                                                                                                                                                   |
| `Host key verification failed`                          | `DEPLOY_KNOWN_HOSTS` doesn't match the server (wrong port or address when scanned, or the server was reinstalled): scan it again.                                                                                                                                                       |
| `Permission denied (publickey)`                         | The public key isn't in the deploy account's `authorized_keys`, or `DEPLOY_SSH` names another account (step 3).                                                                                                                                                                         |
| `Can't reach <user>@<server> on port …`                 | Wrong `DEPLOY_PORT`, or the server's firewall refuses GitHub's addresses.                                                                                                                                                                                                               |
| `.env.production is missing on the server`              | The server's one-time setup isn't done in `DEPLOY_DIR` (step 1).                                                                                                                                                                                                                        |
| The deploy fails at the build                           | The old version is still running. Read the run's log, fix on a branch, merge: it deploys the next night.                                                                                                                                                                                |
| The deploy fails at the migrations                      | The database was restored from the backup taken just before, and the previous version runs again. Read the log, fix, merge.                                                                                                                                                             |
| "The new version isn't healthy: rolling back"           | The new version failed its health check (often a missing or wrong setting in `.env.production`): the previous one runs again. Read the log, fix, merge.                                                                                                                                 |
| "doesn't answer after the deploy: rolling back"         | The public address didn't answer within a minute: proxy, DNS, certificate, or the app itself. "answers again, with the previous version": the site is fine, the release isn't. "still doesn't answer": the problem is around the app (proxy, DNS, certificate), look at the server now. |
| "No previous version on this server"                    | The very first deploy, or the images were deleted: nothing to roll back to. Fix and deploy again.                                                                                                                                                                                       |
| "Branch main is not allowed to deploy to production"    | The environment's branch rule doesn't include `main` (step 4).                                                                                                                                                                                                                          |

## Day to day

- **Pause:** delete the `DEPLOY_SSH` repository variable (backups stop too).
  Set it again to resume.
- **Deploy now** (an urgent fix, or after a server change): **Run workflow**.
  It backs up and stops the app for about a minute, whatever the hour.
- **Roll back:** automatic, with the data, when the deploy fails. By hand,
  right after a failed deploy (while `deploy-state` is there):
  `ssh -p <port> <user>@<server> 'cd apps/<slug>/src && sh scripts/rollback-remote.sh'`.
  After a successful deploy it only swaps the image back and leaves the data
  as it is. For good, revert the bad commit on a branch and merge.
- **Restore the data by hand** (a bad release that passed every check, or a
  mistake in the data): on the server, the latest local backup or one you
  name (download an older one from R2 into `apps/<slug>/backups` first):

  ```bash
  ssh -p <port> <user>@<server> 'cd apps/<slug>/src && sh scripts/restore-remote.sh ../backups/<slug>-<date>.dump'
  ```

  The app is left stopped; start the version that matches the data with
  `docker compose -f docker/compose.production.yaml up -d --no-build app`
  (or `sh scripts/rollback-remote.sh` for the previous one). Everything
  written since that backup is lost.

- **The deploy key leaked:** remove its line from the server's
  `authorized_keys`, then make a new one (steps 3 and 5). **The R2 key
  leaked:** delete the token in Cloudflare, make a new one, update
  `backup.env`.
- **Server reinstalled or moved:** scan its host key again (step 5), and
  copy `backup.env` too.
