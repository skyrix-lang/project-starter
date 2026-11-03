<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guide

Next.js 16 App Router full-stack starter: React 19, TypeScript, Tailwind v4,
PostgreSQL with Drizzle, Zod, Auth.js, Playwright. One app, no separate backend.
See `README.md` for setup and structure. `src/app/bookings/` is the reference
implementation: copy its patterns.

## How to work

1. **Understand.** Read the code you'll change and the pattern it should follow.
   Check `docs/decisions.md` before changing an approach: reverse a decision only
   when asked, and record it.
2. **Agree on big work first.** A feature bigger than one screen, a schema change
   that touches existing data, or one with open product questions gets a spec in
   `docs/specs/` (template there). Wait for answers to its open questions.
3. **Build in small steps,** with the workflow that fits, from
   `.claude/skills/<name>/SKILL.md` (plain Markdown, for any agent): `new-feature`,
   `new-page`, `seo-check`, `run-app`. Run `yarn verify` after each step.
4. **See it work.** Tests prove it; also check the running app (`run-app`): sign
   in with `yarn dev:session`, load the page, read the server output and runtime
   errors.
5. **Done means:** `yarn verify` and `yarn test` pass; new behaviour has tests
   that fail when the code is broken (break it once to check); README,
   `.env.example` and `docs/decisions.md` are updated where needed; and the
   change has been reviewed against these rules.
6. **Report** what changed, how it was checked, and anything skipped or failing.

Ask before: adding a dependency, a migration that deletes or rewrites data,
weakening a security check, or reversing a recorded decision. Don't read `.env`:
it holds secrets. Several agents may work at once, each in its own git worktree:
run `yarn install && yarn setup` in a new one, and it gets its own ports and
databases.

## Commands

- `yarn verify`: format check, types, lint and unit tests, in a few seconds.
  Run it after each step. `yarn test` runs the Playwright suite (needs Docker,
  starts Postgres itself, about a minute). Both must pass before work is done,
  and CI runs both on every pull request.
- `yarn format` fixes formatting. Lint is oxlint and formatting is oxfmt (oxc.rs),
  not ESLint or Prettier. Suppress a rule with
  `// oxlint-disable-next-line <rule>` and a reason.
- `yarn test e2e/<file>.spec.ts` runs one file, `yarn test:unit` the unit tests.
- `yarn setup` prepares a fresh checkout or worktree. `yarn db:generate`,
  `yarn db:migrate`, `yarn db:seed <email>`, `yarn dev:session` (sign in locally).
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

## Environment

- Add new server variables to the schema in `src/lib/env.ts` and read them with
  `env()`, not `process.env`, so a bad value stops the server at startup.
- Add new variables to `.env.example`, and the README if they need explaining.
- `NEXT_PUBLIC_*` values are embedded at build time, so Docker needs them as a
  build argument, not a runtime variable.

## Security

Auth.js handles sign-in (Google and email links): see "Authentication" in the
README. Server Actions and Route Handlers are public endpoints, so each one checks
the session itself. Call `requireUser(returnTo)` from `src/lib/session.ts` in
pages and Server Actions, and `getUser()` in Route Handlers, returning 401 without
a user (`/api/health` is the one public route). The root layout stays static, so
never call `auth()` in it. Data is per user: pass `user.id` to every `src/lib`
function, which filters by it, as `src/lib/bookings.ts` does. Limit anything that
sends email or costs money with `hit()` from `src/lib/rate-limit.ts`. Third-party
scripts, images or APIs need their origins added to the CSP in `next.config.ts`.

## Tests

- Pure logic (schemas, parsing, helpers) gets a unit test next to it, as
  `src/lib/<name>.test.ts`, with `node:test` and `node:assert/strict`.
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
