# Stack migration: Vite SPA + Hono BFF, workspaces

Status: built (2026-11-10). The decisions it led to are in `docs/decisions.md`.

## Context

The starter today is one Next.js 16 app: Server Components and Server Actions, Auth.js (Google and email links), Postgres with Drizzle, `node:test` and Playwright. You want it rebuilt on the stack from your shop spec, so new projects start there:

- a client-only React 19 SPA (Vite 8, TanStack Router and Query, shadcn/ui on Base UI, React Hook Form with Zod 4);
- a small backend-for-frontend (BFF) in the same image;
- versioned packages plus a thin app per customer.

Choices you made:

- **The BFF owns the data.** Hono keeps Postgres and Drizzle and serves the bookings API, with its OpenAPI spec generated from code. The web client, types and MSW mocks are generated from that spec.
- **Sign-in is generic OIDC as a confidential client.** Keycloak runs in Docker for dev and tests. Sessions are stored in Postgres and sent as an HttpOnly cookie.
- **Repo shape:** a Yarn workspaces monorepo.
- **Package manager:** Yarn, on the latest version, with supply-chain settings.

`src/app/bookings` stays the reference feature and is ported to the new stack. Work happens on the branch `stack-migration`, in phases, with `yarn verify` after each. Phase 0 also writes the plan as `docs/specs/stack-migration.md`, as `AGENTS.md` requires.

## Next.js is removed entirely

After the migration, nothing from Next.js is left in the repo.

**Packages:** every dependency that exists because of Next.js is uninstalled, not only `next` itself.

| Package                 | Why it goes                                                               |
| ----------------------- | ------------------------------------------------------------------------- |
| `next`                  | the framework                                                             |
| `@next/env`             | Next.js env-file loader                                                   |
| `next-auth`             | Auth.js for Next.js                                                       |
| `@auth/drizzle-adapter` | Auth.js database adapter                                                  |
| `server-only`           | Next.js server/client import guard                                        |
| `@tailwindcss/postcss`  | Tailwind through Next's PostCSS pipeline; `@tailwindcss/vite` replaces it |
| `nodemailer`            | only used by Auth.js email links                                          |
| `@heroicons/react`      | replaced by `lucide-react`, which shadcn/ui uses                          |

Once this is done, no workspace's `package.json` lists anything from Next.js or Auth.js, and `yarn.lock` has no `next`, `@next/*`, `next-auth` or `@auth/*` entries, transitive ones included. Some packages stay because they aren't tied to Next.js: `react`, `react-dom`, `zod`, `drizzle-orm`, `pg`, `tailwindcss`, `@playwright/test`, `typescript`, `oxlint`, `oxfmt` and `tsx`.

**Files deleted:**

- `next.config.ts`, `next-env.d.ts` and `postcss.config.mjs`;
- all of `src/`: the `app/` router, Route Handlers, Server Actions, `instrumentation*.ts`, `opengraph-image.tsx`, `robots.ts` and `sitemap.ts`. Each is ported to the new packages first, then deleted;
- the `.next` build output and its scripts (`build`, `start` and `clean`, which pointed at `.next/standalone`);
- the `next-devtools` MCP server.

**Rewritten:** the generated Next.js block at the top of `AGENTS.md` ("This is NOT the Next.js you know"). `next dev` will no longer run, so nothing re-adds it.

**Retired concepts:** Server Components, Server Actions, `revalidatePath`, `loading.tsx` and `error.tsx`. They are replaced by TanStack Router and Query, and the BFF.

**Docs:** `AGENTS.md`, `CLAUDE.md`, the README, the skills and the Dockerfile no longer mention Next.js. The old decisions are marked "superseded" in `docs/decisions.md`.

**Final check:** this must print nothing:

```sh
git grep -niE 'next(\.js|/|-auth|js)|@next/' -- ':!docs/decisions.md'
```

`yarn why next`, `yarn why @next/env`, `yarn why next-auth` and `grep -E '^"?(next|@next/|next-auth|@auth/)' yarn.lock` must also report nothing.

## Target layout

```
apps/web/            thin customer app: Vite, routes (TanStack file routes), theme import, page overrides
apps/bff/            Hono on Node: OIDC, sessions, /api/*, OpenAPI doc, static SPA, security headers
packages/core/       Zod schemas + types shared by web and bff (from src/lib/booking-schema.ts, src/types)
packages/db/         Drizzle schema, migrations (drizzle/ moves here), getDb; server only
packages/api/        committed openapi.json + Orval output: typed client, TanStack Query hooks, MSW handlers
packages/ui/         shadcn/ui (Base UI) kit on Tailwind v4: Button (from buttonStyles), Card, Input, Field, Select…
packages/feature-bookings/  bookings list, filter (URL search params), create form (RHF + Zod), status actions
packages/theme-default/     one CSS-variable token file (the per-customer branding surface)
```

**Dependency rules:**

- `ui` imports nothing from the app layer.
- `feature-*` may import `ui`, `api` and `core`.
- `apps/web` may import any package except `db`.
- Only `apps/bff` imports `db`.

Two things enforce these:

- `scripts/check-boundaries.ts`, run in `verify`, which reads each workspace's `package.json` and its imports;
- per-package `no-restricted-imports` rules in oxlint.

Each package gets a short `AGENTS.md`. The root `AGENTS.md` is rewritten for this stack and stays short.

## Phases

**0. Groundwork**

- `yarn set version latest`.
- `.yarnrc.yml`:
  - `enableScripts: false`, with an explicit allowlist only if one is needed (esbuild ships prebuilt binaries);
  - `npmMinimalAgeGate` of 7 days;
  - drop `approvedGitRepositories: "**"`.
- CI already uses `--immutable`.
- Set up the root workspaces, TypeScript project references (`tsc -b`) and a strict base tsconfig.
- Turn on oxlint type-aware linting (`oxlint-tsgolint`).

**1. `packages/core` and `packages/db`**

- Move the schemas and the Drizzle code.
- Unit tests move to Vitest 5 (a workspace config with per-package projects).
- `src/lib/*.test.ts` are ported, not rewritten.

**2. `apps/bff` (Hono + `@hono/node-server`)**

Env and routes:

- `env.ts`, ported from `src/lib/env.ts`, checked at startup and exiting on failure. New variables: `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `SESSION_SECRET` and `PUBLIC_URL`. The `AUTH_*` and Google variables are removed.
- Auth uses `openid-client`: authorization code + PKCE + state/nonce, then `/auth/callback`. It upserts the user by `(issuer, subject)`, creates a session row and sets the cookie (`__Host-session`, HttpOnly, Secure, SameSite=Lax). Logout uses the RP-initiated end-session endpoint.
- The `/api/bookings` routes use `@hono/zod-openapi`, keep the current status codes and error shapes, and serve `/api/openapi.json`. They are ported from `src/app/api/bookings/**` and `src/lib/bookings.ts`, still filtered by `user.id`.
- `/api/me` returns the signed-in user, and `/api/health` stays public.

Security:

- Middleware: `requireUser` (401), a CSRF check on unsafe methods (Origin check, Hono `csrf`), and rate limiting through the existing Postgres `hit()`.
- `secureHeaders` with a strict CSP and no `'unsafe-inline'` for scripts. Vite emits no inline scripts, so this is stricter than today's policy.
- In production the BFF also serves the built SPA, with a history fallback. That keeps one process and one image.

Migration `0003`: this touches existing data, so it needs your OK.

- Add `oidc_issuer` and `oidc_subject` (unique pair) to `users`.
- Drop the Auth.js `accounts` and `verification_tokens` tables.
- Recreate `sessions` as hashed ids with an expiry. Everyone is signed out.

**3. `packages/api`**

- `yarn api:generate` exports the BFF's OpenAPI doc to `packages/api/openapi.json`, then runs Orval.
- `verify` fails if the committed spec or the generated output is stale. That is the contract check between BFF and client.

**4. `packages/ui` + `packages/theme-default`**

- shadcn/ui on Base UI with Tailwind v4 via `@tailwindcss/vite`.
- Tokens are CSS variables in the theme package, and components only use tokens.
- Ports `src/components/ui/*` and the header, footer and user menu (the user menu uses `/api/me`).

**5. `packages/feature-bookings` + `apps/web`**

- TanStack Router with typed search params replaces `?status=`.
- TanStack Query hooks come from the generated client. Mutations invalidate queries, replacing `revalidatePath`.
- The form uses RHF with `zodResolver` and the shared `createBookingSchema`.
- `apps/web` composes the routes and the theme, and declares typed page overrides: a map of route id to component, checked at build time.
- A router `errorComponent` and `notFoundComponent` replace `error.tsx` and `not-found.tsx`.
- Titles use React 19's `<title>`. `robots.txt`, `sitemap.xml`, OG tags and the icon are static files in `apps/web/public` and `index.html`.

**6. Tests**

- Component and feature tests: Vitest browser mode (or jsdom), Testing Library, and MSW handlers from `packages/api`.
- Playwright:
  - Runs against the built BFF serving the built SPA, with its own database.
  - The existing e2e files are ported: `bookings`, `api`, `auth`, `navigation`, `seo`, now a reduced SPA version.
  - `support.ts` keeps failing on console errors. It also gains an axe check (`@axe-core/playwright`, WCAG 2.2 AA tags) on every page tested.
  - Most tests sign in by inserting a session row directly, as `scripts/dev-session.ts` does now.
  - `auth.spec.ts` drives the real Keycloak login.
- Keycloak runs from `scripts/keycloak-up.sh` with a realm import (`docker/keycloak/realm.json`, a test client and user). It replaces Mailpit.
- `scripts/checkout.ts` keeps the per-worktree ports and databases, and adds a Vite port.

**7. Ship and docs**

- `docker/Dockerfile`:
  - builds web and bff, with the BFF bundled by `vite build --ssr`;
  - runs on `node:<.nvmrc>-alpine`, non-root;
  - has a migrate stage, as today;
  - takes configuration from the environment at start, with no build-time public variables.
- CI: the existing two jobs, plus an image build with SBOM and provenance attestations (`docker/build-push-action`) and a cosign signing step for tags.
- Add `SECURITY.md` as the disclosure policy, which the Cyber Resilience Act asks for.
- Rewrite `README.md`, `.env.example` and `AGENTS.md`/`CLAUDE.md`.
- Skills:
  - `new-feature` and `new-page`: rewrite for packages and routes;
  - `run-app`: change to Vite + BFF + `dev:session`;
  - `seo-check`: reduce to the static SPA checks.
- Hooks: `protect-files.mjs` points at the new migrations path; the `yarn.lock` and `.env` protection stays.
- Remove `next-devtools` from `.mcp.json`.
- `docs/decisions.md`:
  - **Replaced** (each entry kept, marked "superseded", with the new decision added at the end): One Next.js app, No TanStack Query/client state, Auth.js, Static CSP with unsafe-inline, node:test, nodemailer.
  - **Kept:** Postgres/Drizzle migrations, Data belongs to a user, Rate limits in Postgres, Env at startup, oxlint/oxfmt, Isolated checkouts.
  - **New:** SPA over SSR, BFF sessions (RFC 10017), packages plus a thin app, Orval contract, Yarn supply-chain settings, WCAG 2.2 AA in CI.

**Zustand:** it is recorded as the client-state choice, and documented, but is only installed with the first feature that needs client state (the basket). The bookings example has none, because filters live in the URL. Say so if you want it installed and used now.

## Dependencies to add (approval of this plan = approval of these)

`vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`, `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`, shadcn/ui's runtime deps (`@base-ui-components/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`), `hono`, `@hono/node-server`, `@hono/zod-openapi`, `openid-client`, `orval`, `msw`, `vitest`, `@vitest/browser` (or `jsdom`), `@testing-library/react`, `@axe-core/playwright`, `oxlint-tsgolint`.

**Removed:** `next`, `next-auth`, `@auth/drizzle-adapter`, `nodemailer`, `server-only`, `@heroicons/react`, `@next/env`, `@tailwindcss/postcss`.

## Verification

- `yarn verify` after every phase: format, `tsc -b`, type-aware oxlint, boundaries, OpenAPI/Orval drift and Vitest.
- `yarn test`: Postgres and Keycloak in Docker, the full Playwright suite with axe.
- Break checks: break one boundary rule, one BFF auth check, one schema field and the generated client once each, and confirm verify or the tests fail.
- `run-app`: start Vite + BFF, sign in through Keycloak and with `yarn dev:session`, then create a booking and filter by status. Check the browser console and the BFF logs.
- `docker build`, then run the migrate stage and the runner against local Postgres and Keycloak. Load `/`, `/bookings` and `/api/health`, and check the response headers (CSP, cookie flags).
- Finish with the `reviewer` subagent, then report what changed, what was checked, and anything skipped.
