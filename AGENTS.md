# Project guide

A booking platform starter, shaped to be sold to companies as **versioned
packages plus a thin app per customer**: a client-only React 19 SPA (Vite,
TanStack Router and Query, shadcn/ui on Base UI, Tailwind v4, React Hook Form,
Zod 4) and a small Hono backend-for-frontend (BFF) that owns sign-in (OpenID
Connect), sessions, the JSON API and Postgres (Drizzle). One Docker image.
See `README.md` for setup. The bookings feature is the reference
implementation: copy its patterns.

```
apps/web                 thin customer app: routes, theme, page overrides
apps/bff                 Hono server: OIDC, sessions, /api, security headers, serves the SPA
packages/core            Zod schemas and types shared by web and BFF
packages/db              Drizzle schema, migrations (server only)
packages/api             generated client, hooks and MSW mocks (never edit by hand)
packages/ui              UI kit on theme tokens
packages/theme-default   the brand: one CSS-variable file
packages/feature-*       feature screens (bookings)
```

Each package has a short `AGENTS.md` with its own rules: read it before
changing that package. `scripts/check-boundaries.ts` enforces which package may
import which.

## How to work

1. **Understand.** Read the code you'll change and the pattern it should follow.
   Check `docs/decisions.md` before changing an approach: reverse a decision only
   when asked, and record it.
2. **Agree on big work first.** A feature bigger than one screen, a schema change
   that touches existing data, or one with open product questions gets a spec in
   `docs/specs/` (template there). Wait for answers to its open questions.
3. **Build in small steps** with the workflow that fits, from
   `.claude/skills/<name>/SKILL.md` (plain Markdown, for any agent): `new-feature`,
   `new-page`, `seo-check`, `run-app`. Run `yarn verify` after each step.
4. **See it work.** Tests prove it; also check the running app (`run-app`): sign
   in with `yarn dev:session`, load the page, read the console and server output.
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

- `yarn verify`: format check, types, type-aware lint, package boundaries, API
  contract and unit tests, in seconds. Run it after each step. `yarn test` runs
  Playwright with axe (needs Docker; starts Postgres and Keycloak itself, about a
  minute). Both must pass before work is done, and CI runs both.
- `yarn format` fixes formatting. Lint is oxlint and formatting is oxfmt
  (oxc.rs), not ESLint or Prettier. Suppress a rule with
  `// oxlint-disable-next-line <rule> -- <reason>`.
- `yarn test e2e/<file>.spec.ts` runs one file, `yarn test:unit` the Vitest
  suites, `yarn test:watch` watches them.
- `yarn api:generate` after changing an API route. `yarn setup`, `yarn dev`,
  `yarn db:generate`, `yarn db:migrate`, `yarn db:seed <email>`,
  `yarn dev:session` (sign in locally).
- Change dependencies with `yarn workspace <name> add|remove`, never by editing
  `package.json`, so `yarn.lock` stays in sync. Install scripts are disabled and
  versions younger than 7 days are refused (`.yarnrc.yml`).

## Frontend (`apps/web`, `packages/ui`, `packages/feature-*`)

- Everything renders in the browser; there is no server rendering. Routes are
  TanStack Router file routes; links and search params are type-checked.
- Read and write server data only through the generated hooks in
  `@booking/api`. Pass `throwOnError: throwUnexpected(...)` so unexpected errors
  reach the route's error page; invalidate query keys after a mutation.
- URL state (filters, tabs) lives in validated search params. Client-only state
  goes in Zustand (not installed yet: ask when the first feature needs it).
- Forms: React Hook Form + `zodResolver` with the schema from `@booking/core`,
  and the `Field` components from `@booking/ui`.
- Style with theme tokens only. A link styled as a button uses
  `buttonVariants()`: never put a `<button>` inside a link.
- Accessibility is a requirement (WCAG 2.2 AA, European Accessibility Act):
  labelled controls, one `h1`, no skipped heading levels, visible focus. Every
  e2e test runs axe on the page it ends on.

## Rendering and SEO

- Every page is **public** (should rank) or **app** (a working screen). See the
  `new-page` skill. Crawlers first read `apps/web/index.html`, whose metadata
  describes the home page; public pages are listed in `PUBLIC_PATHS`.
- App pages set `usePageMeta({ title, noindex: true })` and call `requireUser`
  in `beforeLoad`.

## BFF and data (`apps/bff`, `packages/db`)

- Every API route is declared with `createRoute` and Zod schemas, so it is
  validated and appears in `/api/openapi.json`. Bad input is 400, someone else's
  or a missing record is 404. Run `yarn api:generate` after a change.
- Routes on `userApi` check the session (401). A route outside it is public: say
  why in a comment. Data is per user: pass `c.var.user.id` to every data
  function, which filters by it, as `apps/bff/src/bookings.ts` does.
- Limit anything that sends email or costs money with `hit()` from
  `apps/bff/src/rate-limit.ts`.
- Migrations are like Flyway: edit `packages/db/src/schema.ts`, run
  `yarn db:generate`, review the SQL, commit it. Never edit an applied
  migration. The app never migrates on startup.
- New server variables go in `apps/bff/src/env.ts` (read with `env()`), in
  `.env.example`, and in the README if they need explaining. There are no
  build-time variables: the image is configured when it starts.

## Security

Sign-in is OpenID Connect, authorization code + PKCE, with the BFF as a
confidential client: tokens and the client secret never reach the browser,
which holds only an HttpOnly session cookie (`apps/bff/src/session.ts`). The
CSRF check refuses cross-site form posts; JSON from other origins fails CORS.
Third-party scripts, images or APIs need their origins added to the CSP in
`apps/bff/src/app.ts`; never add `'unsafe-inline'` for scripts.

## Tests

- Pure logic and schemas: Vitest, next to the file (`*.test.ts`).
- Components: Vitest + Testing Library in jsdom, with MSW handlers from
  `@booking/api/mocks`; unhandled requests fail the test.
- New behaviour gets a Playwright test in `e2e/`. Import `test` and `expect`
  from `e2e/support.ts`, so console errors and axe violations fail the test.
- Tests run in parallel on one database. Tests that change data create their own
  rows through a helper with a unique value, and never change seed data. Sign in
  as a new user with `signInAsNewUser`; `auth.spec.ts` covers the real Keycloak
  flow.
- Prefer role-based locators, with `data-testid` for repeated cards.
- Never add test-only routes or code to the app. Trigger failures from the test,
  with `page.route` or direct database access.
- A green run isn't enough for new tests: break the code once and see them fail.
