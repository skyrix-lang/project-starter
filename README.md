# booking-platform

A full-stack starter for new projects, organized as **versioned packages plus a
thin app per customer** and shipped as one Docker image. A small bookings
feature shows every layer; copy its patterns, then replace it with your own.

- **Web:** React 19 single-page app with strict TypeScript and Vite. TanStack
  Router for typed routes and TanStack Query for server data. shadcn/ui-style
  components on Base UI, Tailwind CSS v4, React Hook Form and Zod 4.
- **BFF (backend-for-frontend):** Hono on Node. It signs users in with OpenID
  Connect as a confidential client, keeps sessions in an HttpOnly cookie, serves
  the JSON API from PostgreSQL through Drizzle, sets the security headers and
  serves the built SPA.
- **Contract:** the BFF's routes produce an OpenAPI document. Orval generates
  the typed client, the TanStack Query hooks and the MSW mocks from it.
- **Quality:** oxlint (type-aware) and oxfmt from [oxc.rs](https://oxc.rs),
  Vitest with MSW, Playwright with axe (WCAG 2.2 AA), and dependency rules
  between packages.

## Structure

```
apps/
  web/                      the customer app (thin)
    index.html              HTML shell: metadata crawlers read first
    src/routes/             TanStack Router file routes (/, /bookings, /sign-in)
    src/overrides.ts        typed page overrides for a customer
    src/styles.css          Tailwind + UI kit + the customer's theme
  bff/                      Hono server
    src/app.ts              security headers, CSRF, routes, static SPA
    src/routes/api.ts       JSON API, declared with Zod (OpenAPI)
    src/routes/auth.ts      /auth/login, /auth/callback, /auth/logout
    src/session.ts          server-side sessions (HttpOnly cookie)
    src/env.ts              settings, checked at startup
    src/mail.ts             mail over SMTP (logged when unconfigured)
packages/
  core/                     Zod schemas and types shared by web and BFF
  db/                       Drizzle schema, migrations (drizzle/), seed data
  api/                      openapi.json + generated client, hooks and MSW mocks
  ui/                       UI kit on theme tokens
  theme-default/            the brand: one CSS-variable file
  feature-bookings/         the bookings screens (reference feature)
e2e/                        Playwright tests
scripts/                    setup, dev, session, API generation, boundary check
docker/                     Dockerfile, Keycloak development realm
docs/decisions.md           decisions and their reasons
docs/specs/                 feature specs
```

Each package has a short `AGENTS.md` with its rules.

## Starting a project from this starter

```bash
yarn install
yarn rename acme-portal "Acme Portal"
```

`yarn rename` replaces the starter's name wherever it's an identifier: the
`@booking/*` package scope, the root package and image, the local containers,
database, Keycloak realm and client, and the site name. It leaves the bookings
feature alone: keep it to copy from, and remove it when the project has its
own. Review the diff, then continue below. It also writes `.starter.json`:
commit it, it's where `yarn sync-from-starter` starts from.

The whole setup, from the clone to a GitHub repository with auto-merge, CI,
Claude, Renovate and the starter sync, step by step (Claude can run most of
it): [docs/new-project.md](docs/new-project.md). To deploy `main` to a
server every night, with a database backup first: [docs/auto-deploy.md](docs/auto-deploy.md).

## Keeping a project up to date with the starter

- **Versions:** Renovate updates every repository with one policy, the
  starter's `default.json`; each `renovate.json` only extends it. Install the
  Renovate GitHub app on each repository.
- **Everything else** (scripts, CI, Docker, configs, packages): in the project,
  `yarn sync-from-starter --dry-run`, then `yarn sync-from-starter`. It merges
  what changed in the starter since the commit in `.starter.json` with the
  project's own changes, as `git merge` would. Review, `yarn verify`, commit.
- **Automatically:** a workflow does that when the starter's `main` changes,
  every Monday, or on demand from the Actions tab, and opens a pull request,
  with Claude resolving conflicts. Clean syncs and Renovate's non-major
  updates merge themselves once CI passes (`scripts/setup-github.sh`).
  Claude also reviews every pull request, and `@claude` in an issue or pull
  request asks it for any other work. All need a few secrets: see the guide.

The whole process, conflicts and the rules for changing the starter:
[docs/starter-sync.md](docs/starter-sync.md).

## Getting started

Requires Node 24 (`.nvmrc`), Corepack (`corepack enable`) and Docker.

```bash
yarn install
yarn setup        # .env, Postgres, Keycloak, database and migrations
yarn dev          # http://localhost:3000
```

Sign in as `ada` / `ada` or `grace` / `grace` on the local Keycloak. Then run
`yarn db:seed ada@example.test` to give that user demo bookings. Keycloak's
admin console is at http://localhost:8180 (admin / admin).

`yarn dev` runs the BFF (port 3001, restarts on change) and Vite (port 3000).
Vite forwards `/api` and `/auth` to the BFF, so the browser sees a single
origin, as in production.

## Scripts

| Command                                           | What it does                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `yarn dev`                                        | BFF and Vite dev servers                                                  |
| `yarn build` / `yarn start`                       | production build; serve it with the BFF                                   |
| `yarn verify`                                     | format, types, type-aware lint, boundaries, API contract, unit tests      |
| `yarn test`                                       | Playwright against the production build (Postgres and Keycloak in Docker) |
| `yarn test:unit` / `yarn test:watch`              | Vitest                                                                    |
| `yarn api:generate`                               | OpenAPI document from the BFF's routes, then client, hooks and mocks      |
| `yarn setup`                                      | prepare a checkout or worktree                                            |
| `yarn rename <name> ["Display Name"]`             | once, in a new project: replace the starter's name everywhere             |
| `yarn sync-from-starter [--dry-run]`              | in a project: merge in what changed in the starter since the last sync    |
| `yarn dev:session [email] [--seed]`               | sign in locally without Keycloak, print the cookie                        |
| `yarn db:generate --name=<x>` / `yarn db:migrate` | new migration / apply migrations                                          |
| `yarn db:seed <email>`                            | demo bookings for a user who has signed in                                |
| `yarn db:up` / `yarn keycloak:up`                 | start the local containers                                                |
| `yarn docker:build`                               | build the image                                                           |
| `yarn docker:up` / `yarn docker:down`             | the image with Postgres, migrations and Keycloak (Docker Compose)         |
| `yarn deploy`                                     | ship the current commit to a server, backup first ("Deploying")           |

## Configuration

The BFF reads its settings from the environment when it starts
(`apps/bff/src/env.ts`). A missing or invalid value stops it with a list of
every problem. Nothing is baked in at build time, so one image serves any
customer and any domain.

| Variable                                               | Meaning                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`                                           | the address people use; used for the OIDC callback, the CSRF check, the canonical URL and the sitemap |
| `DATABASE_URL`                                         | Postgres                                                                                              |
| `SESSION_SECRET`                                       | signs the short-lived sign-in cookie (32+ random characters in production)                            |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`  | the identity provider and its confidential client                                                     |
| `PORT`, `HOST`                                         | where the BFF listens (3000 and 0.0.0.0 in the image)                                                 |
| `LOG_LEVEL`                                            | `debug`, `info` (default), `warn`, `error` or `silent`                                                |
| `STATIC_DIR`                                           | the built SPA (set in the image)                                                                      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | the SMTP server mail goes through; unset, mail is only logged (see [Mail](#mail))                     |
| `MAIL_FROM`                                            | the sender, on a domain the SMTP server may send for                                                  |
| `GA_MEASUREMENT_ID`                                    | Google Analytics 4's id (`G-…`); unset, no analytics (see [Analytics](#analytics))                    |

## Authentication

Any OpenID Connect provider works: Keycloak, Entra ID, Auth0, Google and
others. Create a **confidential** client with:

- the authorization code flow and PKCE (S256);
- the redirect URI `${PUBLIC_URL}/auth/callback`;
- the post-logout redirect URI `${PUBLIC_URL}/`;
- the scopes `openid email profile`.

The browser never sees a token or the client secret. After the callback, the
BFF stores a session row and sets an HttpOnly cookie, so deleting the row
signs that session out. Signing out also ends the provider's session. Users
are identified by issuer and subject. A user created ahead of their first
sign-in, by email and with no identity yet (as `yarn dev:session` does), is
linked to it when the provider has verified that email.

Who may sign in is decided by the provider: every account it accepts gets in.
Use the customer's own provider, or restrict a shared one to their users,
groups or domain. Never point `OIDC_ISSUER` at a public provider without such a
restriction.

## Mail

`mailer().send({ to, subject, text, html? })` (`apps/bff/src/mail.ts`) sends
through any SMTP server with Nodemailer, such as Scaleway Transactional Email:

```bash
SMTP_HOST=smtp.tem.scaleway.com
SMTP_PORT=465                       # TLS: 465, 2465. STARTTLS: 587, 2587, 25
SMTP_USER=<project id>
SMTP_PASSWORD=<API secret key>
MAIL_FROM="Acme <no-reply@acme.example>"   # on a domain verified in TEM
```

Credentials never travel unencrypted: ports other than 465 and 2465 must
upgrade with STARTTLS, or the mail isn't sent. A refused mail throws.

**No real mail in tests.** Without `SMTP_HOST`, nothing is sent: the mail is
logged (recipient and subject in development, a bare warning in production).
`vitest.config.ts` and `playwright.config.ts` both empty `SMTP_HOST`, which
wins over `.env` and the shell. In production a sent mail is logged by its
message id only, and a refusal by its SMTP codes, without the server's reply
(it often quotes the recipient). `yarn dev`
does send when `.env` has SMTP settings, so use addresses you own there.

Anything that sends mail because of a request must be rate limited with
`hit()` from `apps/bff/src/rate-limit.ts`.

## API

The JSON API lives under `/api`. Its OpenAPI document is at
`/api/openapi.json`, and `packages/api/openapi.json` is the committed copy.

- Every route except `/api/health`, `/api/me` and the document checks the
  session and returns 401 without one.
- Data is per user. Another user's booking behaves as if it doesn't exist (404).
- Bad input gets 400 with `{ error, issues }`.

To change the API, edit `apps/bff/src/routes/api.ts`, run `yarn api:generate`
and commit both. `yarn verify` fails when the generated client is stale.

## Customizing for a customer

- **Branding:** copy `packages/theme-default` into a new theme package, change
  the CSS variables, and import it in `apps/web/src/styles.css`. Components use
  only these tokens. `scripts/theme-contrast.test.ts` (in `yarn verify`) fails
  when a text colour drops below 4.5:1 on its background, or an input border,
  the focus ring or a button below 3:1, in every `theme-*` package and in each
  mode it defines (light, and dark if it has one).
- **Link previews and icons:** replace `apps/web/public/og-image.png`
  (1200 × 630), `favicon.ico` (48, 32 and 16 px) and `apple-touch-icon.png`
  (180 px, square corners) with the customer's own, and the name, URL and
  logo in `index.html`'s JSON-LD.
- **Pages:** replace a package's page in `apps/web/src/overrides.ts`. A route
  that doesn't exist is a type error. Add the customer's own routes in
  `apps/web/src/routes/`.
- **Features:** add a `packages/feature-*` package. It may depend on `core`,
  `api` and `ui` only (`scripts/check-boundaries.ts`).

## Tests

- **Unit and component tests** (`yarn test:unit`) live next to the code. Pure
  logic runs on Node. Components run in jsdom with Testing Library, and every
  request goes to MSW handlers from `@booking/api/mocks`; an unhandled request
  fails the test.
- **End-to-end tests** (`yarn test`) build the app and run it with the bundled
  BFF on its own port and database, signing in through the local Keycloak.
  Every test also fails on a browser console error, or on an axe accessibility
  violation (WCAG 2.2 AA) on the page it ends on. Most tests sign in by writing
  a session row; `e2e/auth.spec.ts` drives the real Keycloak login.

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

### Deploying

Off until a project turns it on: the starter ships the scripts, and nothing
deploys anywhere until you run `yarn deploy` or set the Deploy workflow's
`DEPLOY_SSH` variable. [docs/auto-deploy.md](docs/auto-deploy.md) is the
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

3. `backup.env`, for the backups (see "Backups" below): no deploy runs
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

### Backups

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

### Deploying automatically

`.github/workflows/deploy.yml` runs every night at 02:00, Paris time: it
deploys `main` if the server doesn't run that commit yet and CI passed on it,
and otherwise backs the database up. **Run workflow** in the Actions tab
deploys `main` at once. It does nothing, in the starter and in any project,
until the `DEPLOY_SSH` repository variable is set. Turning it on (a deploy
key, the `production` environment, two secrets and a variable):
[docs/auto-deploy.md](docs/auto-deploy.md).

### Logs

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

## SEO

The app renders in the browser. Every URL first returns `apps/web/index.html`,
and the BFF fills in `PUBLIC_URL` when it serves it. That file carries the home
page's title, description, canonical URL, Open Graph tags and JSON-LD.
`robots.txt` and `sitemap.xml` are built from `PUBLIC_URL`. The pages listed in
`PUBLIC_PATHS` (`packages/core/src/site.ts`) appear in the sitemap. App pages
add `noindex` when they render. A public page that has to rank on its own
content needs prerendering (see `docs/decisions.md`).

Unknown addresses answer 404: the build writes the app's routes to
`routes.json` (from TanStack Router's route tree), and the BFF sends the
app's page, which shows "Page not found", with a 404 status for any path that
matches none. A route that exists but finds nothing (a missing record) still
answers 200, so its page says `noindex` too.

The `www.` twin of `PUBLIC_URL`'s host (or the bare domain, when
`PUBLIC_URL` has `www.`) redirects to `PUBLIC_URL` with a 301, so the site
isn't indexed twice. Point both names at the server: other hosts are left
alone, since a proxy may pass its own name.

`index.html`'s JSON-LD describes the site and the organisation behind it,
with its logo (`apple-touch-icon.png`), which search results may show.

Link previews use Open Graph and X's card tags: title, description, URL, site
name, locale and a share image (`apps/web/public/og-image.png`, 1200 × 630).
Each page passes its own to `usePageMeta` (`apps/web/src/page-meta.ts`):
`title`, `description`, `image`, `imageAlt`, `type`, and `jsonLd` for
structured data such as an `Event` or a `FAQPage`. Platforms that don't run
JavaScript (most link previews) see the home page's tags from `index.html`.

## Analytics

Google Analytics 4 is off until `GA_MEASUREMENT_ID` is set (`G-` and the id
from the GA property's web stream). Then:

- the BFF writes the id into `index.html` and adds Google's origins to the
  CSP (script, image and connect sources only, never `'unsafe-inline'`);
- a banner asks visitors whether they accept. Nothing is loaded from Google
  and no cookie is set until they do. The choice is kept in the browser for
  six months, then asked again, and "Cookie settings" in the footer changes it;
- Google's library starts with Consent Mode v2 denying everything, then
  grants analytics storage only. Advertising storage stays denied;
- page views of client-side navigations come from GA4's enhanced measurement
  ("Page changes based on browser history events", on by default). Leave it
  on, or pages after the first aren't counted. Such a page view can carry the
  previous page's title (the URL is right): the router changes the address
  before the page sets its title;
- turning on Google Signals in GA's admin makes the library call more of
  Google's hosts (`stats.g.doubleclick.net`, `www.google.com`): add them to
  the CSP in `apps/bff/src/app.ts` first, or the browser blocks them.

Before turning it on, describe it in the site's privacy policy (the footer's
"Privacy" link). The banner's text is in
`apps/web/src/components/consent-banner.tsx`.

## Compression

`yarn build` writes a brotli (`.br`) and a gzip (`.gz`) copy of each text file
of the SPA (`apps/web/vite.config.ts`). The BFF sends the smallest copy the
browser accepts, with `Content-Encoding` and `Vary: Accept-Encoding`, and
compresses `index.html` once when it starts. A proxy in front need not
compress again: nginx leaves a response that already has an encoding alone.

## Security

- Sign-in uses OIDC with PKCE through a confidential client. Sessions are
  server-side, the cookie is HttpOnly and SameSite=Lax (`__Host-` on https),
  and only a hash of the session token is stored.
- The CSP allows scripts from `'self'` only, with no `'unsafe-inline'` (plus
  Google's, when [analytics](#analytics) is turned on). The
  other headers are HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict
  referrer policy (`apps/bff/src/app.ts`). Add third-party origins there.
- The CSRF check refuses cross-site form posts. There is no CORS, so other
  origins can't send JSON.
- Sign-ins are rate limited per client address (`apps/bff/src/rate-limit.ts`).
- Supply chain: install scripts are disabled, versions younger than 7 days are
  refused, CI installs from the lockfile only, and Renovate waits 7 days too.

## Working with AI agents

`AGENTS.md` is the guide for every agent, with a short `AGENTS.md` per package.
`CLAUDE.md` adds Claude Code's skills, reviewer subagent and hooks. Strict
types, the generated API client, the boundary check and tests that run in
seconds are the guardrails. `yarn verify` is what an agent runs after each step.
