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

```
src/
  app/
    layout.tsx                  root layout (fonts, shell, Header/Footer)
    page.tsx                    Home (Server Component)
    bookings/page.tsx           Bookings list (SSR, ?status= filter)
    bookings/actions.ts         Server Actions (confirm / cancel)
    bookings/filter-bar.tsx     status filter links
    bookings/submit-button.tsx  submit button with a pending state
    bookings/loading.tsx        loading skeleton
    api/bookings/route.ts       GET list / POST create
    api/bookings/[id]/route.ts  PATCH status
    error.tsx, not-found.tsx    error and 404 pages
    icon.svg                    favicon
    globals.css                 Tailwind v4 theme
  lib/                          data layer and validation schemas
  lib/db/                       Drizzle schema, connection and demo data
  components/                   layout + UI components
  hooks/                        reusable client hooks
  types/                        shared types
drizzle/                        SQL migrations
scripts/                        database helper scripts
e2e/                            Playwright tests
```

## Getting started

Needs Node 22 and Docker.

```bash
yarn install
cp .env.example .env
yarn db:up        # start Postgres in Docker
yarn db:migrate   # create the tables
yarn db:seed      # add demo bookings (optional)
yarn dev
```

## Scripts

```bash
yarn dev      # start the dev server (Turbopack) on http://localhost:3000
yarn build    # production build (emits .next/standalone with assets)
yarn start    # run the standalone production server
yarn check    # type-check with tsc --noEmit
yarn lint     # lint with ESLint
yarn test     # run the Playwright tests
yarn clean    # remove build output
```

## Database

```bash
yarn db:up        # start the local Postgres container
yarn db:down      # stop it (data is kept in the booking-db volume)
yarn db:generate  # create a migration from changes to the schema
yarn db:migrate   # apply pending migrations
yarn db:seed      # add demo bookings to an empty database
yarn db:studio    # browse the data in Drizzle Studio
```

To change the database, edit `src/lib/db/schema.ts`, run `yarn db:generate`,
review the new SQL file in `drizzle/`, commit it, then run `yarn db:migrate`.
Applied migrations are recorded in `drizzle.__drizzle_migrations`. The app never
migrates on startup: run it as a deploy step, before the new version starts.

## Tests

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

## Docker

```bash
# Build the app image. The site URL is embedded in the build.
NEXT_PUBLIC_SITE_URL=https://example.com yarn docker:build

# Apply migrations, then start the app
docker build --target migrate -t booking-platform-migrate -f docker/Dockerfile .
docker run --rm -e DATABASE_URL=... booking-platform-migrate
docker run -p 3000:3000 -e DATABASE_URL=... booking-platform:1.0.0
```

The image runs the Next.js standalone server on a Node runtime (required for
SSR and Server Actions) as a non-root user. `DATABASE_URL` is read when the
container starts. In production, use a managed Postgres and run the migrate image
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
query fails, `/bookings` returns 200 and the browser shows the error page, so
health checks should use `/api/bookings`, which returns 500.

## Before using this for real data

There is no authentication yet. Server Actions and Route Handlers are public
endpoints, so add auth checks to `src/app/bookings/actions.ts` and
`src/app/api/bookings` first.
