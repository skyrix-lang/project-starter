# Decisions

Choices made on purpose, with the reason and when to reconsider them. Don't reverse
one as a side effect of other work: propose it, and record the outcome here. New
decisions go at the end.

## One Next.js app, no separate backend

Server Components read data by calling `src/lib` directly. Server Actions handle
mutations from the UI. Route Handlers exist only for the JSON API.
**Why:** one deploy, one language, no API layer to keep in sync with the UI.
**Revisit when:** another client (a mobile app, a partner) needs most of the API.

## No tRPC, TanStack Query or client state library

**Why:** Server Components and Server Actions cover reads and writes, and
`revalidatePath` refreshes the page. A client cache would duplicate server state.
**Revisit when:** a screen needs polling, infinite scroll or heavy optimistic
updates. Ask first.

## Postgres with Drizzle, migrations as committed SQL

`yarn db:generate` writes SQL from `src/lib/db/schema.ts`. It's reviewed and
committed, never edited once applied, and run as a deploy step, not at startup.
**Why:** the SQL that runs in production is the SQL that was reviewed, and a
failed migration stops a deploy rather than a running app.

## Auth.js v5 with database sessions

Google and email links, no passwords. Sessions are rows, so deleting one signs
the user out at once. The root layout stays static, so the header reads the
session in the browser (`UserMenu`).
**Why:** no passwords to store or reset, and revocable sessions.
**Open:** v5 has been in beta for a long time. Better Auth is the likely
replacement if that becomes a problem; it would also bring its own rate limiting.

## Data belongs to a user

Every row of per-user data has a `user_id`. Every `src/lib` function takes the
signed-in user's id and filters by it, and another user's row behaves as if it
doesn't exist (404). The owner column isn't returned.
**Why:** the check lives in one place per query, not in each caller, and a missing
filter shows up in review as an unused argument.
**Revisit when:** something needs sharing or roles: add them explicitly, don't
loosen the filter.

## Static Content Security Policy

Set in `next.config.ts`, with `'unsafe-inline'` for scripts.
**Why:** a nonce-based policy needs every page rendered per request, which would
stop public pages from being static and cached.
**Revisit when:** the app handles data sensitive enough to give up static pages,
or Next.js's hash-based (SRI) support is stable and covers inline scripts.

## Rate limits in Postgres

Fixed-window counters in the `rate_limits` table (`src/lib/rate-limit.ts`).
**Why:** no extra service such as Redis, and every instance shares the counts.
**Revisit when:** something rate-limited is hot enough that a row write per hit
matters.

## Environment checked at startup

`src/lib/env.ts` validates with Zod. `src/instrumentation-node.ts` runs it when
the server starts, and exits on failure, because Next.js would otherwise log the
error and keep serving.
**Why:** a bad deploy fails where it's deployed, not on the first request.

## Unit tests with `node:test`, end-to-end tests with Playwright

Unit tests run through `tsx`, with no test framework installed. Playwright tests
run against a production build, with their own database.
**Why:** no Vite or Vitest to maintain for a handful of pure-logic tests, and the
e2e tests exercise what ships.
**Revisit when:** unit tests need mocking, watch mode or a DOM.

## oxlint and oxfmt, not ESLint and Prettier

**Why:** much faster, one toolchain, enough rules for this project.

## `nodemailer` v10 despite the peer warning

`next-auth` declares `^7 || ^8`, but every 8.x has security advisories, and Auth.js
only uses `createTransport` and `sendMail`, which haven't changed. Don't downgrade.

## Each checkout is isolated

The main checkout uses port 3000 and the `booking` database. A git worktree gets
its own dev port, dev database and e2e port and database (`scripts/checkout.ts`,
`yarn setup`). Postgres and Mailpit are shared.
**Why:** several agents can work in parallel worktrees without one's migrations or
test reset breaking another's.
