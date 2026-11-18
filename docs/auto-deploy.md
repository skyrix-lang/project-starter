# Deploying a project automatically

How to make a project made from the starter deploy itself to a server (a VPS
with Docker) each time CI passes on its `main`. With auto-merge on
([new-project.md](new-project.md)), the whole chain runs on its own: a pull
request merges once CI passes, then the deploy ships it, migrates the
database and restarts the app. A failed migration or health check stops the
deploy with the old version still running, and GitHub notifies you that the
run failed.

`zbeul` was the first project set up this way: its `scripts/deploy.sh`,
`scripts/deploy-remote.sh`, `docker/compose.production.yaml` and
`.github/workflows/deploy.yml` are the reference to copy from.

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
merge into main ─▶ CI (checks + Playwright) ─▶ Deploy workflow
                                               │ SSH with a key for this only,
                                               │ to a server whose host key is pinned
                                               ▼
                         yarn deploy: copy the commit, build the image there,
                         run the migrations, restart once healthy
```

- **The trigger:** `workflow_run` on CI, only when CI passed on a **push** to
  `main` (a merge), never on a pull request's CI run. It deploys the exact
  commit CI tested. **Run workflow** in the Actions tab redeploys by hand.
- **One at a time:** a newer deploy waits for the one in progress, and is
  never cancelled in the middle of a migration.
- **Secrets:** in a GitHub **environment** called `production`, limited to
  `main`, so only a job deploying `main` can read them. You can also require
  your approval for each deploy there.
- **Off switch:** the workflow does nothing until the `DEPLOY_SSH`
  repository variable is set. Delete it to pause deploys.

## 1. The project can deploy by hand (Claude, then You)

Automatic deploys run the project's own `yarn deploy`, so that must work
first, from your machine.

- **Claude:** if the project has no `scripts/deploy.sh` yet, copy
  `scripts/deploy.sh`, `scripts/deploy-remote.sh` and
  `docker/compose.production.yaml` from zbeul, with the project's names
  (zbeul → the project's slug), and the "Deploying" section of zbeul's
  README. Add `"deploy": "sh scripts/deploy.sh"` to `package.json`'s scripts.
  `scripts/deploy.sh` must stay runnable with only `git`, `ssh` and `tar`
  (no Node, no Yarn), and read `DEPLOY_SSH`, `DEPLOY_PORT`, `DEPLOY_DIR` and
  `DEPLOY_SSH_OPTIONS` from the environment.
- **You:** on the server, the one-time setup that README section lists:
  Docker, the proxy, a database and its user, and the project's
  `.env.production`. Then one deploy by hand:

  ```bash
  DEPLOY_SSH=<user>@<server> DEPLOY_PORT=<port> yarn deploy
  ```

  If this doesn't work, stop here: GitHub would only fail the same way,
  with less to see.

## 2. The workflow (Claude)

Copy `.github/workflows/deploy.yml` from zbeul. Change only the default of
`DEPLOY_DIR` (`apps/zbeul` → `apps/acme-portal`, the folder in the deploy
user's home). It must keep:

- `on: workflow_run` of `CI`, `types: [completed]`, `branches: [main]`, and
  `workflow_dispatch`;
- `concurrency: { group: deploy, cancel-in-progress: false }`;
- on the job: `if: vars.DEPLOY_SSH != '' && (github.event_name == 'workflow_dispatch' || (github.event.workflow_run.conclusion == 'success' && github.event.workflow_run.event == 'push'))`,
  and `environment: production`;
- checkout at `github.event.workflow_run.head_sha || github.sha`;
- the key and `known_hosts` written from the two secrets, with an error if
  either is empty;
- `sh scripts/deploy.sh` with
  `DEPLOY_SSH_OPTIONS="-i $HOME/.ssh/id_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes"`
  (`$HOME`, not `~`: a tilde isn't expanded inside a variable);
- a last step, `if: always()`, that deletes the key.

Record it in the project's `docs/decisions.md` ("Main deploys itself", as
zbeul does), and add a "Deploying automatically" section to its README that
points here. Merging the workflow deploys nothing yet: `DEPLOY_SSH` isn't set.

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

## 6. First deploy (You, then Claude)

**You:** Actions → **Deploy** → **Run workflow** on `main`, or:

```bash
gh workflow run deploy.yml -R skyrix-lang/acme-portal --ref main
```

**Claude:** check the run. A good one ends with the migrations applied, the
app container `Healthy`, and `Deployed <commit>`:

```bash
id=$(gh run list -R skyrix-lang/acme-portal --workflow deploy.yml -L 1 --json databaseId --jq '.[0].databaseId')
gh run view "$id" -R skyrix-lang/acme-portal --log | grep -E "migrations|Healthy|Deployed|error"
```

Then open the site: the run checks the container's health, not the public
address through the proxy.

## When something doesn't work

| Symptom                                                 | Cause, and the fix                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| The Deploy job is **skipped**                           | `DEPLOY_SSH` is missing at the **repository** level (often set on the environment instead): move it (step 5). Or CI didn't pass.      |
| "Set the DEPLOY_SSH_KEY and DEPLOY_KNOWN_HOSTS secrets" | One is empty or not in the `production` environment. An empty `DEPLOY_KNOWN_HOSTS` usually means `ssh-keyscan` ran on the wrong port. |
| `Host key verification failed`                          | `DEPLOY_KNOWN_HOSTS` doesn't match the server (wrong port or address when scanned, or the server was reinstalled): scan it again.     |
| `Permission denied (publickey)`                         | The public key isn't in the deploy account's `authorized_keys`, or `DEPLOY_SSH` names another account (step 3).                       |
| `Can't reach <user>@<server> on port …`                 | Wrong `DEPLOY_PORT`, or the server's firewall refuses GitHub's addresses.                                                             |
| `.env.production is missing on the server`              | The server's one-time setup isn't done in `DEPLOY_DIR` (step 1).                                                                      |
| The deploy fails at the migrations or the health check  | The old version is still running. Read the run's log, fix on a branch, merge: it deploys again.                                       |
| "Branch main is not allowed to deploy to production"    | The environment's branch rule doesn't include `main` (step 4).                                                                        |

## Day to day

- **Pause:** delete the `DEPLOY_SSH` repository variable. Set it again to
  resume.
- **Redeploy** (after a server change): **Run workflow**.
- **Roll back:** revert the bad commit on a branch and merge: it deploys
  again. A migration isn't undone by a revert: write a new one.
- **The key leaked:** remove its line from the server's `authorized_keys`,
  then make a new one (steps 3 and 5).
- **Server reinstalled or moved:** scan its host key again (step 5).
- **Back up the database** before relying on this: a migration that loses
  data succeeds, and nothing restores it. A `pg_dump` before each migration
  and a nightly copy off the server cover it.
