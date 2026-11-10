# Decisions

Choices made on purpose, with the reason and when to reconsider them. Don't reverse
one as a side effect of other work: propose it, and record the outcome here. New
decisions go at the end.

## One Next.js app, no separate backend

**Superseded (2026-11-10)** by "Client-only SPA and a BFF, no Next.js".

Server Components read data by calling `src/lib` directly. Server Actions handle
mutations from the UI. Route Handlers exist only for the JSON API.
**Why:** one deploy, one language, no API layer to keep in sync with the UI.
**Revisit when:** another client (a mobile app, a partner) needs most of the API.

## No tRPC, TanStack Query or client state library

**Superseded (2026-11-10)** by "TanStack Query through a generated client".

**Why:** Server Components and Server Actions cover reads and writes, and
`revalidatePath` refreshes the page. A client cache would duplicate server state.
**Revisit when:** a screen needs polling, infinite scroll or heavy optimistic
updates. Ask first.

## Postgres with Drizzle, migrations as committed SQL

`yarn db:generate` writes SQL from `packages/db/src/schema.ts` into
`packages/db/drizzle/`. It's reviewed and
committed, never edited once applied, and run as a deploy step, not at startup.
**Why:** the SQL that runs in production is the SQL that was reviewed, and a
failed migration stops a deploy rather than a running app.

## Auth.js v5 with database sessions

**Superseded (2026-11-10)** by "OIDC confidential client in the BFF".

Google and email links, no passwords. Sessions are rows, so deleting one signs
the user out at once. The root layout stays static, so the header reads the
session in the browser (`UserMenu`).
**Why:** no passwords to store or reset, and revocable sessions.
**Open:** v5 has been in beta for a long time. Better Auth is the likely
replacement if that becomes a problem; it would also bring its own rate limiting.

## Data belongs to a user

Every row of per-user data has a `user_id`. Every BFF data function takes the
signed-in user's id and filters by it, and another user's row behaves as if it
doesn't exist (404). The owner column isn't returned.
**Why:** the check lives in one place per query, not in each caller, and a missing
filter shows up in review as an unused argument.
**Revisit when:** something needs sharing or roles: add them explicitly, don't
loosen the filter.

## Static Content Security Policy

**Superseded (2026-11-10)** by "Strict CSP set by the BFF".

Set in `next.config.ts`, with `'unsafe-inline'` for scripts.
**Why:** a nonce-based policy needs every page rendered per request, which would
stop public pages from being static and cached.
**Revisit when:** the app handles data sensitive enough to give up static pages,
or Next.js's hash-based (SRI) support is stable and covers inline scripts.

## Rate limits in Postgres

Fixed-window counters in the `rate_limits` table (`apps/bff/src/rate-limit.ts`).
**Why:** no extra service such as Redis, and every instance shares the counts.
**Revisit when:** something rate-limited is hot enough that a row write per hit
matters.

## Environment checked at startup

`apps/bff/src/env.ts` validates with Zod. `apps/bff/src/server.ts` runs it when
the server starts, and exits on failure.
**Why:** a bad deploy fails where it's deployed, not on the first request.

## Unit tests with `node:test`, end-to-end tests with Playwright

**Superseded (2026-11-10)** by "Vitest, MSW and Playwright with axe".

Unit tests run through `tsx`, with no test framework installed. Playwright tests
run against a production build, with their own database.
**Why:** no Vite or Vitest to maintain for a handful of pure-logic tests, and the
e2e tests exercise what ships.
**Revisit when:** unit tests need mocking, watch mode or a DOM.

## oxlint and oxfmt, not ESLint and Prettier

**Why:** much faster, one toolchain, enough rules for this project.

## `nodemailer` v10 despite the peer warning

**Superseded (2026-11-10)** by "OIDC confidential client in the BFF" (no email sign-in, no nodemailer).

`next-auth` declares `^7 || ^8`, but every 8.x has security advisories, and Auth.js
only uses `createTransport` and `sendMail`, which haven't changed. Don't downgrade.

## Each checkout is isolated

The main checkout uses ports 3000 (Vite) and 3001 (BFF) and the `booking`
database. A git worktree gets its own dev ports, dev database and e2e port and
database (`scripts/checkout.ts`, `yarn setup`). Postgres and Keycloak are shared.
**Why:** several agents can work in parallel worktrees without one's migrations or
test reset breaking another's.

## Client-only SPA and a BFF, no Next.js

React 19 + Vite builds static files; a small Hono server (the BFF) serves them,
handles sign-in and sessions, and owns the JSON API and the database. No server
rendering. The structure follows the shop specification this starter is built
for (product sold to companies, one core, many customer projects).
**Why:** the 2025-2026 server-rendering vulnerabilities (React Server Components
RCE, Next.js middleware bypass, cache poisoning) can't apply to static files;
one image per customer is simple to configure at start; and React with typed
routes is what coding agents handle best.
**Cost:** public pages are client-rendered. Crawlers get `index.html`'s metadata
first; a page that must rank on its own content needs prerendering.
**Revisit when:** public content must rank beyond the home page: prerender those
routes (React Router 8 with `ssr: false` prerendering, or a static generator)
rather than reintroducing a request-time server renderer.

## Versioned packages plus a thin app per customer

`packages/*` hold the core, the generated API client, the UI kit, features and
a theme; `apps/web` composes them, adds routes and declares typed page
overrides (`apps/web/src/overrides.ts`) at build time. Packages export their
TypeScript source and are consumed through Yarn workspaces for now.
`scripts/check-boundaries.ts` enforces which package may import which, and that
each declares what it imports.
**Why:** vendors that shipped a copied starter (Medusa, Saleor, Hydrogen) ended
up writing migration guides; packages put semver on the customization surface.
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
A user who existed before with the same verified email is linked, not
duplicated, so existing data survives the switch from Auth.js.
**Why:** the IETF guidance for browser apps (RFC 10017) recommends against
tokens in the browser for apps handling personal data, and the old app's client
secret in the bundle must not come back.

## TanStack Query through a generated client

The BFF's routes are declared with `@hono/zod-openapi`, which produces
`/api/openapi.json`. Orval generates the typed client, TanStack Query hooks and
MSW mocks into `packages/api` (`yarn api:generate`); `yarn api:check` in
`yarn verify` fails when either is stale. Zustand is the client-state library,
added with the first feature that needs it (the basket).
**Why:** a wrong field or route is a compile error instead of a runtime one, and
agents never hand-write API types.

## Strict CSP set by the BFF

`script-src 'self'` with no `'unsafe-inline'`: Vite emits no inline scripts.
`form-action` allows the identity provider, for sign-out. Set in
`apps/bff/src/app.ts` with Hono's `secureHeaders`.
**Why:** stricter than the old static policy, at no cost now that nothing is
server-rendered.

## Vitest, MSW and Playwright with axe

Vitest runs unit tests (node) and component tests (jsdom, Testing Library,
MSW handlers from the generated mocks; unhandled requests fail). Playwright runs
against the production bundle with real Postgres and Keycloak, and every test
also fails on a console error or an axe WCAG 2.2 AA violation.
**Why:** fast feedback that makes agent-written code trustworthy, and the
European Accessibility Act covers e-commerce and e-ticketing.

## Yarn supply-chain settings

`.yarnrc.yml` disables install scripts and refuses versions published less than
7 days ago; CI installs with `--immutable`; Dependabot waits 7 days too. Release
images carry an SBOM and provenance and are signed with cosign; `SECURITY.md`
is the disclosure policy.
**Why:** npm worms kept arriving through 2026, and the Cyber Resilience Act
expects SBOMs and vulnerability handling for delivered software.
**Revisit when:** a dependency truly needs its install script: allow that one
package in `dependenciesMeta`, never globally.
