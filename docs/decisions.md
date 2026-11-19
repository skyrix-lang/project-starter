# Decisions

Choices made on purpose, with the reason and when to reconsider them. Don't reverse
one as a side effect of other work: propose it, and record the outcome here. New
decisions go at the end.

## Client-only SPA and a BFF

React 19 + Vite builds static files; a small Hono server (the BFF) serves them,
handles sign-in and sessions, and owns the JSON API and the database. No server
rendering.
**Why:** request-time server rendering has had critical vulnerabilities in
2025-2026 (remote code execution, middleware bypass, cache poisoning) that
can't apply to static files; one image per customer is simple to configure at
start; and React with typed routes is what coding agents handle best.
**Cost:** public pages are client-rendered. Crawlers get `index.html`'s metadata
first; a page that must rank on its own content needs prerendering.
**Revisit when:** public content must rank beyond the home page: prerender those
routes (React Router 8 with `ssr: false` prerendering, or a static generator)
rather than adding a request-time server renderer.

## Versioned packages plus a thin app per customer

`packages/*` hold the core, the generated API client, the UI kit, features and
a theme; `apps/web` composes them, adds routes and declares typed page
overrides (`apps/web/src/overrides.ts`) at build time. Packages export their
TypeScript source and are consumed through Yarn workspaces for now.
`scripts/check-boundaries.ts` enforces which package may import which, and that
each declares what it imports.
**Why:** one core serves many customer projects, and each upgrades by bumping
package versions instead of merging changes into a copy: semver sits on the
customization surface.
**Revisit when:** a customer project lives in its own repository: publish the
packages to a private registry with a build step and changesets. Skip
micro-frontends unless customers must ship pages without a rebuild.

## OIDC confidential client in the BFF

The BFF signs users in with OpenID Connect (authorization code + PKCE, state and
nonce) as a confidential client, using `openid-client`. Users are identified by
issuer and subject; sessions are rows in `user_sessions` holding a hash of the
cookie's token, so deleting a row signs out at once. The browser only holds an
HttpOnly, SameSite=Lax cookie (`__Host-` on https). Signing out also ends the
provider's session. Local development and tests use Keycloak in Docker
(`docker/keycloak/realm.json`); production uses the customer's provider.
A user created ahead of their first sign-in (by email, with no identity yet)
is linked when the provider has verified that email, not duplicated.
**Why:** the IETF guidance for browser apps (RFC 10017) recommends against
tokens in the browser for apps handling personal data, and a client secret
must never be in the bundle.
**Open:** sessions last 30 days and aren't rechecked with the provider, so a
user disabled there stays signed in until expiry. Add a shorter or sliding
expiry, a refresh-token check, or back-channel logout when a customer needs it.

## Data belongs to a user

Every row of per-user data has a `user_id`. Every BFF data function takes the
signed-in user's id and filters by it, and another user's row behaves as if it
doesn't exist (404). The owner column isn't returned.
**Why:** the check lives in one place per query, not in each caller, and a missing
filter shows up in review as an unused argument.
**Revisit when:** something needs sharing or roles: add them explicitly, don't
loosen the filter.

## TanStack Query through a generated client

The BFF's routes are declared with `@hono/zod-openapi`, which produces
`/api/openapi.json`. Orval generates the typed client, TanStack Query hooks and
MSW mocks into `packages/api` (`yarn api:generate`); `yarn api:check` in
`yarn verify` fails when either is stale. Zustand is the client-state library,
added with the first feature that needs client-only state.
**Why:** a wrong field or route is a compile error instead of a runtime one, and
agents never hand-write API types.

## Postgres with Drizzle, migrations as committed SQL

`yarn db:generate` writes SQL from `packages/db/src/schema.ts` into
`packages/db/drizzle/`. It's reviewed and committed, never edited once applied,
and run as a deploy step (the image's `migrate` stage), not at startup.
**Why:** the SQL that runs in production is the SQL that was reviewed, and a
failed migration stops a deploy rather than a running app.

## Rate limits in Postgres

Fixed-window counters in the `rate_limits` table (`apps/bff/src/rate-limit.ts`).
**Why:** no extra service such as Redis, and every instance shares the counts.
**Revisit when:** something rate-limited is hot enough that a row write per hit
matters. The client address comes from `x-forwarded-for`, so deploy behind a
proxy that sets it.

## Environment checked at startup

`apps/bff/src/env.ts` validates with Zod. `apps/bff/src/server.ts` runs it when
the server starts, and exits on failure. Nothing is read at build time, so one
image serves any customer and domain.
**Why:** a bad deploy fails where it's deployed, not on the first request.

## Strict CSP set by the BFF

`script-src 'self'` with no `'unsafe-inline'`: Vite emits no inline scripts.
`form-action` allows the identity provider, for sign-out. Set in
`apps/bff/src/app.ts` with Hono's `secureHeaders`.
**Why:** the strongest policy that costs nothing when nothing is
server-rendered.
**Revisit when:** a provider's `end_session_endpoint` isn't on the issuer's
host: add its origin to `form-action`.

## Vitest, MSW and Playwright with axe

Vitest runs unit tests (node) and component tests (jsdom, Testing Library,
MSW handlers from the generated mocks; unhandled requests fail). Playwright runs
against the production bundle with real Postgres and Keycloak, and every test
also fails on a console error or an axe WCAG 2.2 AA violation.
**Why:** fast feedback that makes agent-written code trustworthy, and the
European Accessibility Act covers e-commerce and e-ticketing.

## oxlint and oxfmt, not ESLint and Prettier

Lint is type-aware (`oxlint --type-aware`, with `oxlint-tsgolint`).
**Why:** much faster, one toolchain (oxc.rs), enough rules for this project.

## Yarn supply-chain settings

`.yarnrc.yml` disables install scripts and refuses versions published less than
7 days ago; CI installs with `--immutable`; Renovate waits 7 days too. Release
images carry an SBOM and provenance and are signed with cosign; `SECURITY.md`
is the disclosure policy.
**Why:** npm worms kept arriving through 2026, and the Cyber Resilience Act
expects SBOMs and vulnerability handling for delivered software.
**Revisit when:** a dependency truly needs its install script: allow that one
package in `dependenciesMeta`, never globally.

## Each checkout is isolated

The main checkout uses ports 3000 (Vite) and 3001 (BFF) and the `booking`
database. A git worktree gets its own dev ports, dev database and e2e port and
database (`scripts/checkout.ts`, `yarn setup`). Postgres and Keycloak are shared.
**Why:** several agents can work in parallel worktrees without one's migrations or
test reset breaking another's.

## Node 24, pinned in three places

`.nvmrc` (local and CI), the base image in `docker/Dockerfile` (by digest) and
the BFF's build target in `apps/bff/vite.config.ts` name the same major version.
**Why:** an even-numbered release in long-term support, with security fixes
until April 2028, and it still ships Corepack, which provides Yarn.
**Revisit when:** moving to Node 26 or later: Corepack is no longer bundled, so
the image and CI must install it (or Yarn) themselves. Change all three together.

## Structured logs on stdout, without a library

`apps/bff/src/log.ts` writes one JSON line per event in production and text in
development, with a request id carried by `AsyncLocalStorage` and returned as
`x-request-id`. Requests are logged with their path only, and errors with their
message, code and stack only.
**Why:** a container's platform collects stdout and can filter JSON by level or
request id; a query string can carry a sign-in code, and libraries attach
query parameters and token responses to their errors; and one small file needs
no dependency.
**Revisit when:** traces or metrics are needed, or a second service must share
a request's id: add OpenTelemetry then, and keep `log` as the one entry point.

## Compose file for trying the image, not for production

`docker/compose.yaml` runs the image with Postgres, the migration stage and a
development Keycloak, in deploy order. Keycloak is reached as
`keycloak.localhost` on the same port by the browser and by the app, because
the issuer must be one address for both.
**Why:** the image is what ships, so there must be a one-command way to run it
as it runs in production. Its secrets are public: it is not a deployment.

## Projects follow the starter

Projects are copies of the starter (`yarn rename`), not forks or packages.
Renovate updates versions in every repository with one shared policy
(`default.json`, a preset each `renovate.json` extends), and
`yarn sync-from-starter` merges the starter's other changes into a project,
file by file, with `yarn rename`'s rules applied. See `docs/starter-sync.md`.
**Why:** a shared tooling package can't carry CI, Docker or app code, and
needs a registry and releases for every change; merging the starter as a git
remote conflicts on every renamed line. Renovate replaced Dependabot because
Dependabot can't share a config between repositories.
Pull requests merge themselves once CI passes (GitHub auto-merge, CI required
on `main`, merge commits only: `scripts/setup-github.sh`): Renovate's
non-major updates, and a sync that applied cleanly, which the starter
triggers as soon as its `main` changes. A sync with conflicts, even ones
Claude resolved, and Renovate majors wait for a person.
**Why (auto-merge):** one person maintains the starter and its projects; a
clean, green sync is the starter's reviewed change arriving unchanged, while a
resolved conflict is a judgement call CI can't check.
**Revisit when:** there are more than about five active projects, or parts of
the starter (`ui`, `core`) stop changing per project: publish those as
packages.

## Mail over SMTP, logged when unconfigured

The BFF sends mail with Nodemailer through any SMTP server (Scaleway
Transactional Email for now), configured by `SMTP_*` and `MAIL_FROM` at
start. Without `SMTP_HOST` mail is logged and dropped; Vitest and the e2e
run empty it, so tests can't reach a real inbox.
**Why:** SMTP keeps the provider swappable without code changes, and one
switch (is a server set?) is simpler to trust than a per-environment rule.
**Revisit when:** a test must read a mail's content (a sign-in or invitation
link): add a local catcher such as Mailpit to the dev containers and point
the e2e run's `SMTP_HOST` at it, or when a provider's HTTP API is needed
(templates, bounces, webhooks).

## Deploys ship in the starter, off until turned on

The starter carries the whole deploy (`yarn deploy`, the server scripts,
`docker/compose.production.yaml`, the nightly `Deploy` workflow), first built
for zbeul. Nothing runs until a project sets the `DEPLOY_SSH` variable. Every
night at 02:00 (Paris), the workflow deploys `main` if the server doesn't run
it yet and CI passed on it; each deploy stops the app, backs the database up
to Cloudflare R2 and proves the backup restores before migrating, and a
failed migration, health check or public https check restores the database
(only if a migration ran) and starts the previous image. Nights without a
deploy back up all the same.
**Why:** each project would otherwise rebuild the same scripts, and drift;
shipped in the starter, a fix reaches every project with the next sync. At
02:00 nobody uses the app, so stopping it for a minute makes the backup
exact: nothing written between backup and rollback is lost. R2 has no egress
fees and an S3 API. Building on the server needs no registry.
**Revisit when:** a project is used at night or its database takes minutes
to dump (migrate without stopping, point-in-time recovery), or a project
deploys somewhere other than one Docker server.
