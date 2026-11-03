@AGENTS.md

# Project guide

Next.js 16 App Router full-stack starter: React 19, TypeScript, Tailwind v4,
PostgreSQL with Drizzle, Zod, Playwright. One app, no separate backend. See
`README.md` for setup and structure. `src/app/bookings/` is the reference
implementation: copy its patterns.

Use the `new-page`, `new-feature` and `seo-check` skills for those tasks.

## Commands

- `yarn check`, `yarn lint`, `yarn test`: all three must pass before work is done.
  `yarn test` needs Docker, and starts Postgres itself.
- `yarn db:up`, `yarn db:generate`, `yarn db:migrate`, `yarn db:seed`.
- Change dependencies with `yarn add` and `yarn remove`, never by editing
  `package.json`, so `yarn.lock` stays in sync. Docker uses `--immutable`.

## Next.js

- Read the guide in `node_modules/next/dist/docs/` before using an API you
  haven't checked in this version. It can differ from older releases: for example
  `params` and `searchParams` are promises, and `error.tsx` receives
  `{ error: unknown, retry }`.
- Server Components by default. Put `"use client"` on small leaf components only.
- Read data in Server Components by calling `src/lib` directly. Never fetch this
  app's own Route Handlers from the server.
- Mutate with Server Actions, then `revalidatePath`. Route Handlers are for the
  public JSON API.
- Don't add tRPC, TanStack Query or a client state library by default. Consider
  them only for a screen that needs polling, infinite scroll or heavy optimistic
  updates, and ask first.
- Use `next/link`, `next/image`, `next/font` and the Metadata API. Style a link as
  a button with `buttonStyles()`: never put a `<button>` inside a `<Link>`.
- Render the same output on server and client. Use CSS breakpoints instead of
  checking the screen size in render. Client hooks reading browser state use
  `useSyncExternalStore`.
- Expected failures are return values, or simply a refreshed page. Throw only for
  unexpected errors, which reach `error.tsx`.

## Rendering and SEO

- Every page is either **public** (should rank) or **app** (a working screen).
  This decides its rendering and metadata: see the `new-page` skill.
- Public pages stay static or cached, and don't get `loading.tsx`. A Suspense
  boundary streams the content, which then needs JavaScript and always returns
  HTTP 200.
- App pages may stream and use `loading.tsx`, and set `robots: { index: false }`.
- Each page has one `h1`, and headings never skip a level.

## Data and validation

- Database code lives in `src/lib` and imports `server-only`.
- Validate everything from outside with Zod, including Server Action arguments.
  Route Handlers use `safeParse`, return 400 on failure, and read bodies with
  `request.json().catch(() => null)`.
- Migrations are like Flyway: edit `src/lib/db/schema.ts`, run `yarn db:generate`,
  review the SQL, commit it. Never edit an applied migration. The app never
  migrates on startup.
- `schema.ts` can't use the `@/` alias, because drizzle-kit doesn't resolve it.

## Environment

- Add new variables to `.env.example`, and the README if they need explaining.
- `NEXT_PUBLIC_*` values are embedded at build time, so Docker needs them as a
  build argument, not a runtime variable.

## Security

Auth.js handles sign-in (Google and email links): see "Authentication" in the
README. Server Actions and Route Handlers are public endpoints, so each one checks
the session itself. Call `requireUser(returnTo)` from `src/lib/session.ts` in
pages and Server Actions, and `getUser()` in Route Handlers, returning 401 without
a user. The root layout stays static, so never call `auth()` in it. Every
signed-in user can see all bookings, so say so when a feature needs per-user data.

## Tests

- New behaviour gets a Playwright test in `e2e/`. Import `test` and `expect` from
  `e2e/support.ts` so console errors, including hydration mismatches, fail the test.
- Tests run in parallel on one database. Tests that change data create their own
  rows through a helper with a unique value, and never change seed data.
- Prefer role-based locators, with `data-testid` for repeated cards.
- Never add test-only routes or code to the app. Trigger failures from the test,
  with `page.route` or direct database access.
- Use `gotoHydrated` before relying on client behaviour.
- Don't assert that a page works without JavaScript if it has a `loading.tsx`.
- A green run isn't enough for new tests: break the code once and see them fail.
