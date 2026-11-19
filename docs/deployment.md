# Deployment

The Docker image, deploying it to a server, backups and logs.

## Docker

```bash
yarn docker:build
# Apply migrations (a deploy step, never at startup), then start the app
docker build --target migrate -t booking-migrate -f docker/Dockerfile .
docker run --rm -e DATABASE_URL=... booking-migrate
docker run -p 3000:3000 -e PUBLIC_URL=https://bookings.example.com \
  -e DATABASE_URL=... -e SESSION_SECRET=... \
  -e OIDC_ISSUER=... -e OIDC_CLIENT_ID=... -e OIDC_CLIENT_SECRET=... \
  booking-platform:1.0.0
```

The runtime image holds Node, a single bundled `server.js` and the static
files: no `node_modules`, no package manager, and it runs as a non-root user.
Its base image is pinned by digest, and Renovate updates it. The image has a
`HEALTHCHECK` on `GET /api/health` (503 when the database is unreachable), and
on `SIGTERM` the server finishes the requests in progress before it exits.

To try the image with everything around it, `yarn docker:up` runs
`docker/compose.yaml`: Postgres, the migrations, a development Keycloak and
the app at http://localhost:8080 (ada / ada). It's for local use only, and
needs a browser that treats `keycloak.localhost` as this machine (Chrome and
Firefox do; Safari needs a line in `/etc/hosts`).

## Deploying

Off until a project turns it on: the starter ships the scripts, and nothing
deploys anywhere until you run `yarn deploy` or set the Deploy workflow's
`DEPLOY_SSH` variable. [auto-deploy.md](auto-deploy.md) is the
step-by-step setup (Claude can follow it).

`docker/compose.production.yaml` runs the image on a server (a VPS with
Docker) behind an [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy)
with its Let's Encrypt companion, on the proxy's `nginx-proxy` network, which
also reaches a shared Postgres as `postgres`. The app must be served over
https.

One-time setup on the server, in the deploy folder (`apps/booking-platform`
in the deploy user's home by default; `DEPLOY_DIR` changes it):

1. Create a database and its user in Postgres. The user must **own** the
   database: a restore drops and creates the `public` schema.
2. `.env.production`, readable by its owner only, with the production values
   of `.env.example` (its "Production" section lists the extra ones):

   ```bash
   mkdir -p ~/apps/booking-platform && install -m 600 /dev/null ~/apps/booking-platform/.env.production && nano ~/apps/booking-platform/.env.production
   ```

3. `backup.env`, for the backups (see [Backups](#backups)): no deploy runs
   without it.

Then, for each release, from a checkout of the commit to ship:

```bash
DEPLOY_SSH=<user>@<server> DEPLOY_PORT=<port> yarn deploy
```

`scripts/deploy.sh` copies the commit to the server (no git there), then
`scripts/deploy-remote.sh`:

1. builds the new image while the old version still serves people, keeping
   the running one as `booking-platform-app:previous`;
2. stops the app, so nothing is written from the backup on;
3. backs the database up and proves the backup (see "Backups"). If that
   fails, the old version starts again and nothing is migrated;
4. applies the migrations, then starts the new version and waits for its
   health check.

Then `yarn deploy` checks the public address (the server's `PUBLIC_URL`, or
`DEPLOY_URL`): `/api/health` and `/` must answer over https within about a
minute.

**Rollback.** When step 4 fails, or the public address doesn't answer,
`scripts/rollback-remote.sh` puts back both halves and the deploy fails:

- **the database**, from the backup of step 3, if a migration ran since (it
  compares how many migrations the database has applied with the count
  before the deploy). The app was stopped since the backup, so nothing is
  lost;
- **the app**: `booking-platform-app:previous` starts again.

By hand, right after a failed deploy:
`ssh -p <port> <user>@<server> 'cd apps/booking-platform/src && sh scripts/rollback-remote.sh'`.

## Backups

`scripts/backup-remote.sh` dumps the database (`pg_dump` with the server's
own Postgres version), restores the dump into a throwaway Postgres and
compares its tables (and, before a deploy, every table's row count), uploads
it to a Cloudflare R2 bucket and checks R2 holds all of it. It runs before
every deploy, and every night once automatic deploys are on. The last 7 also
stay on the server, in `apps/booking-platform/backups`.

One-time setup:

1. **Cloudflare dashboard:** R2 → **Create bucket** (`booking-platform-backups`,
   location automatic). In its Settings → **Object lifecycle rules**, delete
   objects after 30 days. Then R2 → **Manage API tokens** → **Create API
   token**: **Object Read & Write**, on that bucket only. Keep the Access Key
   ID, the Secret Access Key and your Account ID (R2's overview page, or the
   part before `.r2.cloudflarestorage.com` in the S3 endpoint).
2. **On the server**, next to `.env.production`, from the template
   `docker/backup.env.example`:

   ```bash
   install -m 600 /dev/null ~/apps/booking-platform/backup.env && nano ~/apps/booking-platform/backup.env
   ```

   ```bash
   R2_ACCOUNT_ID=<account id>
   R2_BUCKET=booking-platform-backups
   AWS_ACCESS_KEY_ID=<access key id>
   AWS_SECRET_ACCESS_KEY=<secret access key>
   ```

3. **Try it**, once a deploy has copied the scripts there:

   ```bash
   ssh -p <port> <user>@<server> 'cd apps/booking-platform/src && sh scripts/backup-remote.sh'
   ```

   It ends with `Backup OK: … tables restored and checked, in R2.`

**Restoring by hand**, with the latest backup or one you name (download an
older one from R2 into `apps/booking-platform/backups` first). The app is
stopped and left stopped; the restore is one transaction, so a failed one
changes nothing:

```bash
ssh -p <port> <user>@<server> 'cd apps/booking-platform/src && sh scripts/restore-remote.sh ../backups/booking-platform-<date>.dump'
```

Then start the version that matches the data:
`docker compose -f docker/compose.production.yaml up -d --no-build app`.

## Deploying automatically

`.github/workflows/deploy.yml` runs every night at 02:00, Paris time: it
deploys `main` if the server doesn't run that commit yet and CI passed on it,
and otherwise backs the database up. **Run workflow** in the Actions tab
deploys `main` at once. It does nothing, in the starter and in any project,
until the `DEPLOY_SSH` repository variable is set. Turning it on (a deploy
key, the `production` environment, two secrets and a variable):
[auto-deploy.md](auto-deploy.md).

## Logs

The BFF writes one line per event to stdout, and warnings and errors to
stderr: JSON in the image, readable text in development. Each request is one
line with its method, path (never the query string), status and duration,
except health checks that succeed. Its id is returned as `x-request-id` and
added to everything logged while handling it; a proxy that sends
`x-request-id` keeps its own id. Errors are logged with their message, code
and stack only: query parameters and whatever a library attached to them are
dropped. Log with `log` from `apps/bff/src/log.ts`; lint refuses `console`.

CI builds the image on `main` and on tags, with an SBOM and build provenance,
and signs release tags with cosign. See `SECURITY.md`.
