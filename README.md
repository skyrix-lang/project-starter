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

## Getting started

Requires Node 22 (`.nvmrc`), Corepack (`corepack enable`) and Docker.

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
| `yarn dev:session [email] [--seed]`               | sign in locally without Keycloak, print the cookie                        |
| `yarn db:generate --name=<x>` / `yarn db:migrate` | new migration / apply migrations                                          |
| `yarn db:seed <email>`                            | demo bookings for a user who has signed in                                |
| `yarn db:up` / `yarn keycloak:up`                 | start the local containers                                                |
| `yarn docker:build`                               | build the image                                                           |

## Configuration

The BFF reads its settings from the environment when it starts
(`apps/bff/src/env.ts`). A missing or invalid value stops it with a list of
every problem. Nothing is baked in at build time, so one image serves any
customer and any domain.

| Variable                                              | Meaning                                                                                               |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `PUBLIC_URL`                                          | the address people use; used for the OIDC callback, the CSRF check, the canonical URL and the sitemap |
| `DATABASE_URL`                                        | Postgres                                                                                              |
| `SESSION_SECRET`                                      | signs the short-lived sign-in cookie (32+ random characters in production)                            |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | the identity provider and its confidential client                                                     |
| `PORT`, `HOST`                                        | where the BFF listens (3000 and 0.0.0.0 in the image)                                                 |
| `STATIC_DIR`                                          | the built SPA (set in the image)                                                                      |

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
  only these tokens.
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
Health check: `GET /api/health` (503 when the database is unreachable).

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

## Security

- Sign-in uses OIDC with PKCE through a confidential client. Sessions are
  server-side, the cookie is HttpOnly and SameSite=Lax (`__Host-` on https),
  and only a hash of the session token is stored.
- The CSP allows scripts from `'self'` only, with no `'unsafe-inline'`. The
  other headers are HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict
  referrer policy (`apps/bff/src/app.ts`). Add third-party origins there.
- The CSRF check refuses cross-site form posts. There is no CORS, so other
  origins can't send JSON.
- Sign-ins are rate limited per client address (`apps/bff/src/rate-limit.ts`).
- Supply chain: install scripts are disabled, versions younger than 7 days are
  refused, CI installs from the lockfile only, and Dependabot has a cooldown.

## Working with AI agents

`AGENTS.md` is the guide for every agent, with a short `AGENTS.md` per package.
`CLAUDE.md` adds Claude Code's skills, reviewer subagent and hooks. Strict
types, the generated API client, the boundary check and tests that run in
seconds are the guardrails. `yarn verify` is what an agent runs after each step.
