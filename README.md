# booking-platform

A Next.js 16 (App Router) full-stack starter: React 19, Tailwind CSS v4,
TypeScript, PostgreSQL and Drizzle.

## Architecture

A single full-stack Next.js app — there is no separate backend process. The
"backend" lives inside the app:

- **Server Components** render pages on the server (SSR).
- **`src/lib/bookings.ts`** is the server-only data layer. It uses
  [Drizzle](https://orm.drizzle.team) to query PostgreSQL: the tables are defined
  in `src/lib/db/schema.ts`, and `DATABASE_URL` sets the connection.
- **`src/lib/booking-schema.ts`** holds the Zod schemas shared by the Server
  Actions and the Route Handlers.
- **Route Handlers** (`src/app/api/bookings`) expose a JSON HTTP API.
- **Server Actions** (`src/app/bookings/actions.ts`) handle mutations from
  forms and revalidate the page.
- **[Auth.js](https://authjs.dev)** (`src/lib/auth.ts`) signs people in with
  Google or an emailed link, and keeps sessions in Postgres. See
  [Authentication](#authentication).
- **`src/lib/env.ts`** validates the server's environment variables with Zod.
  `src/instrumentation.ts` runs it when the server starts, so a missing or
  invalid value stops it with a list of every problem.

```
src/
  app/
    layout.tsx                  root layout (fonts, shell, Header/Footer)
    page.tsx                    Home (Server Component)
    bookings/page.tsx           Bookings list (SSR, ?status= filter)
    bookings/actions.ts         Server Actions (confirm / cancel)
    bookings/filter-bar.tsx     status filter links
    bookings/loading.tsx        loading skeleton
    sign-in/page.tsx            sign-in page (Google, email link)
    sign-in/actions.ts          sign-in Server Actions
    sign-in/check-email/        "check your email" page
    api/bookings/route.ts       GET list / POST create
    api/bookings/[id]/route.ts  PATCH status
    api/health/route.ts         public health check (database reachable)
    api/auth/[...nextauth]/     Auth.js endpoints (callbacks, sign-out, session)
    error.tsx, not-found.tsx    error and 404 pages
    icon.svg                    favicon
    globals.css                 Tailwind v4 theme
  lib/                          data layer and validation schemas
  lib/auth.ts                   Auth.js config: providers, adapter, allowlist, limits
  lib/env.ts                    environment validation
  lib/rate-limit.ts             Postgres-backed rate limiter
  lib/session.ts                getUser() / requireUser() for pages, actions, routes
  lib/db/                       Drizzle schema, connection and demo data
  instrumentation.ts            runs once at server start: checks the environment
  components/                   layout + UI components
  types/                        shared types
drizzle/                        SQL migrations
scripts/                        database helper scripts
e2e/                            Playwright tests
src/**/*.test.ts                unit tests (node:test)
.github/                        CI workflow and Dependabot
```

## Getting started

Needs Node 22 and Docker.

```bash
yarn install
cp .env.example .env
yarn db:up        # start Postgres in Docker
yarn mail:up      # start Mailpit, which catches sign-in emails
yarn db:migrate   # create the tables
yarn dev
```

Set `AUTH_SECRET` in `.env` (`npx auth secret` prints one). To sign in, enter any
email on `/sign-in` and open the link at http://localhost:8025. Bookings belong
to the user who creates them, so to see demo data, sign in once, then run
`yarn db:seed you@example.com` with that address.

## Scripts

```bash
yarn dev      # start the dev server (Turbopack) on http://localhost:3000
yarn build    # production build (emits .next/standalone with assets)
yarn start    # run the standalone production server
yarn check    # type-check with tsc --noEmit
yarn lint     # lint with oxlint (.oxlintrc.json)
yarn format   # format with oxfmt (.oxfmtrc.json); format:check only checks
yarn test:unit # run the unit tests (no Docker or build needed)
yarn test     # run the Playwright tests
yarn clean    # remove build output
```

## Database

```bash
yarn db:up        # start the local Postgres container
yarn db:down      # stop it (data is kept in the booking-db volume)
yarn db:generate  # create a migration from changes to the schema
yarn db:migrate   # apply pending migrations
yarn db:seed <email>  # give a signed-in user the demo bookings
yarn db:studio    # browse the data in Drizzle Studio
yarn mail:up      # start Mailpit: SMTP on :1025, inbox at http://localhost:8025
yarn mail:down    # stop it
```

To change the database, edit `src/lib/db/schema.ts`, run `yarn db:generate`,
review the new SQL file in `drizzle/`, commit it, then run `yarn db:migrate`.
Applied migrations are recorded in `drizzle.__drizzle_migrations`. The app never
migrates on startup: run it as a deploy step, before the new version starts.

## Tests

Unit tests for pure logic, such as validation schemas, sit next to the code as
`src/**/*.test.ts` and run with `yarn test:unit`. They use Node's built-in
[test runner](https://nodejs.org/api/test.html) and `node:assert`, run through
`tsx` so TypeScript and the `@/` alias work: no test framework to install. The
`react-server` condition makes `server-only` importable outside Next.js. They
take a second and need no database. Anything that needs the database, the
server or a browser is an end-to-end test.

End-to-end tests live in `e2e/` and use [Playwright](https://playwright.dev).
Install the browser once, then run them:

```bash
yarn playwright install chromium
yarn test              # run everything
yarn test:ui           # interactive mode
yarn test:report       # open the last HTML report
yarn test e2e/api.spec.ts --project=api   # run one file
```

`yarn test` starts Postgres, builds the app and runs the production server on
port 3100, so a running `yarn dev` is not affected. Each run drops and recreates a
separate `booking_e2e` database, never the one in `.env`. To use another server,
for example in CI, set `E2E_DATABASE_URL`; its database name must end in `_e2e`.

- **Projects:** `api` tests the Route Handlers without a browser. `desktop` and
  `mobile` run every browser test at both sizes.
- **Console errors fail a test.** That's how hydration mismatches get caught. A
  test that causes one on purpose sets `test.use({ allowConsoleErrors: true })`.
- **Tests run in parallel on one database.** A test that changes data should
  create its own booking with `createBooking` from `e2e/support.ts`.
- **Seed data belongs to the shared user.** `e2e/reset-database.ts` creates
  `e2e-shared@example.test` with the demo bookings, and the signed-in tests use
  that user. A test that signs in as its own user starts with no bookings.
- **Each test has its own client address.** Sign-in emails are rate limited per
  address, so `e2e/support.ts` sends a random `x-forwarded-for` from each test.
- **Tests are signed in.** The `setup` project signs in once through the real
  email flow (Mailpit) and saves the session to `e2e/.auth/`; the other projects
  reuse it. A test that signs out or ends a session must use its own user:
  `test.use(signedOut)` then `signInByEmail(page)`. Set `E2E_SMTP_URL` and
  `E2E_MAILPIT_URL` to use another Mailpit.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`.
One job runs `yarn format:check`, `yarn check`, `yarn lint` and
`yarn test:unit`. The other runs
`yarn test`, which starts Postgres and Mailpit in Docker on the runner, just as it
does locally. With `CI` set, Playwright retries a failed test twice and fails on
`test.only`. The HTML report is uploaded as the `playwright-report` artifact.
Dependabot (`.github/dependabot.yml`) opens weekly update pull requests for
dependencies, GitHub Actions and the Docker image, and CI runs on each of them.

## Docker

```bash
# Build the app image. The site URL is embedded in the build.
NEXT_PUBLIC_SITE_URL=https://example.com yarn docker:build

# Apply migrations, then start the app
docker build --target migrate -t booking-platform-migrate -f docker/Dockerfile .
docker run --rm -e DATABASE_URL=... booking-platform-migrate
docker run -p 3000:3000 -e DATABASE_URL=... -e AUTH_SECRET=... \
  -e AUTH_URL=https://example.com -e AUTH_EMAIL_SERVER=... -e AUTH_EMAIL_FROM=... \
  booking-platform:1.0.0
```

The image runs the Next.js standalone server on a Node runtime (required for
SSR and Server Actions) as a non-root user. `DATABASE_URL` and the `AUTH_*`
variables are read when the container starts, not at build time. In production, use a managed Postgres and run the migrate image
as a one-off job before each deploy.

## SEO

- **Site details** live in `src/lib/site.ts`. Set `NEXT_PUBLIC_SITE_URL` to the
  public address. It's read at build time, and a production build fails without it.
- **Each public page** should set `alternates: { canonical: "/its-path" }` and
  `openGraph` (spreading `sharedOpenGraph`), and be added to `src/app/sitemap.ts`.
- **App screens** such as `/bookings` set `robots: { index: false }` and stay out
  of the sitemap.
- **Social image:** `src/app/opengraph-image.tsx` generates it. Add one to a route
  folder to override it there.
- **Structured data:** the home page describes the site as a `WebSite`. Add the
  type that fits each project, such as `LocalBusiness` or `Event`.

## JavaScript

Pages are server-rendered, but `/bookings` needs JavaScript in the browser:
`loading.tsx` adds a Suspense boundary, so the page is streamed after the skeleton
and JavaScript swaps it in. Without JavaScript the skeleton stays on screen. The
content is still in the HTML, for crawlers that read it. Delete `loading.tsx` if a
route has to work without JavaScript; you lose the skeleton.

Streaming also means the HTTP status is sent before the database answers. If a
query fails, `/bookings` returns 200 and the browser shows the error page. So for
health checks, use `/api/health` instead: it needs no session, and returns 200
`{"status":"ok"}` when the database answers, or 503 when it doesn't. Point the
load balancer's or orchestrator's readiness check at it.

## Security headers

`next.config.ts` sends a Content Security Policy, HSTS, `nosniff`,
`X-Frame-Options` and `Referrer-Policy` on every response.

- **The CSP is static**, so public pages stay static. It allows inline scripts,
  because Next.js inlines its own. A [nonce-based policy](https://nextjs.org/docs/app/guides/content-security-policy)
  is stricter but renders every page on each request.
- **Adding a third party** (analytics, a CDN, an embedded map) means adding its
  origins to the matching directive. Playwright tests fail on any CSP violation,
  because the browser reports it as a console error.
- **HSTS** tells browsers to use HTTPS for two years, including subdomains.
  Browsers ignore it over plain HTTP, so local development is unaffected. Remove
  `includeSubDomains` if a subdomain still needs plain HTTP.

## Authentication

[Auth.js](https://authjs.dev) v5 (`next-auth`) with its Drizzle adapter. Nobody
creates an account or a password: people sign in with **Google**, or with a
**link sent by email**. The first sign-in creates the user. Sessions are rows in
the `sessions` table, so ending one (for example by deleting it) takes effect
immediately.

| Variable                               | Needed for                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `AUTH_SECRET`                          | Always. Signs cookies and tokens. `npx auth secret`. 32+ characters in production                 |
| `AUTH_URL`                             | Always in production. The public address; sign-in links use it, never the request's `Host` header |
| `AUTH_EMAIL_SERVER`, `AUTH_EMAIL_FROM` | Email links. An SMTP URL such as `smtps://user:pass@smtp.resend.com:465`                          |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google                                                                                            |
| `AUTH_ALLOWED_EMAILS`                  | Optional. Comma-separated addresses and `@domains` allowed to sign in                             |

- **A provider is on when its variables are set**, and the sign-in page only
  shows those. Leave Google's unset to use email only, or the reverse.
- **Google:** in Google Cloud Console, under APIs & Services → Credentials,
  create an OAuth client ID of type "Web application". Add
  `${AUTH_URL}/api/auth/callback/google` as an authorised redirect URI (one for
  `http://localhost:3000` too, for development).
- **Email:** any SMTP service works, such as Resend, Postmark or Amazon SES.
  Locally, `yarn mail:up` runs Mailpit, which shows every email instead of
  sending it. `nodemailer` is on v10 although `next-auth` declares `^7 || ^8`:
  every 8.x has security advisories, and Auth.js only uses `createTransport` and
  `sendMail`, which haven't changed. Ignore that peer warning; don't downgrade.
- **Who can sign in:** by default, anyone who can receive email or has a Google
  account. Set `AUTH_ALLOWED_EMAILS` (for example `@yourcompany.com`) to limit it.
- **What's protected:** `/bookings` and its Server Actions send signed-out
  visitors to `/sign-in`, and `/api/bookings` returns 401. The JSON API uses the
  same session cookie, so it's meant for the browser, not for scripts.
- **Bookings are per user:** each one has a `user_id`, and every function in
  `src/lib/bookings.ts` takes the signed-in user's id and only reads or changes
  that user's rows. Another user's booking acts as if it doesn't exist (404 in
  the API). Copy this for any per-user data.
- **Sign-in emails are rate limited:** three per address and ten per client
  address every 15 minutes, counted in the `rate_limits` table, so all server
  instances share them. Beyond that, `/sign-in` shows "Too many sign-in emails".
  The client address is the last `x-forwarded-for` entry, so run the app behind
  a reverse proxy that sets it: without one, a client can send its own and get
  around the per-client limit. Change the limits at the top of `src/lib/auth.ts`.
- **Protecting new code:** call `requireUser(returnTo)` from `src/lib/session.ts`
  at the top of each page and Server Action, and `getUser()` in each Route
  Handler. Check inside each one: a layout or `proxy.ts` check alone doesn't
  protect a Server Action.
