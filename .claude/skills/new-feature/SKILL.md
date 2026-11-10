---
name: new-feature
description: Build a full-stack feature in this project across the database, BFF API, generated client and React UI, with migrations and tests. Use for new features, new entities, new forms, or changes to the database schema.
---

# Build a feature

If the feature is bigger than one screen, changes existing data, or has open
product questions, write a spec in `docs/specs/` first and get the open questions
answered.

Work from the database up, and include only the layers the feature needs. The
bookings feature shows every layer: `packages/db/src/schema.ts`,
`packages/core/src/booking-schema.ts`, `apps/bff/src/bookings.ts`,
`apps/bff/src/routes/api.ts`, `packages/feature-bookings/` and
`apps/web/src/routes/bookings.tsx`.

## 1. Database (`packages/db`)

1. Edit `packages/db/src/schema.ts`, using real column types.
2. Run `yarn db:up`, then `yarn db:generate --name=<what_changed>`.
3. Read the SQL in `packages/db/drizzle/`. Check that existing rows survive it:
   a new `NOT NULL` column needs a default, and a rename can be generated as
   drop and add.
4. Run `yarn db:migrate`. Never edit a migration that has already been applied.
5. Enforce rules in the database where possible, such as unique or foreign keys.

## 2. Schemas (`packages/core`)

Add Zod schemas to `packages/core/src/<entity>-schema.ts`: the BFF validates
with them and the form reuses them. Name request and response schemas with
`.meta({ id: "Name" })` so the generated client gets named types. Unit-test
them next to the file with Vitest.

## 3. Data layer (`apps/bff/src/<entity>.ts`)

Small async functions using `getDb()`, no HTTP code. For per-user data, give
the table a `user_id` and make each function take the user's id and filter by
it, as `apps/bff/src/bookings.ts` does: another user's row then behaves as if
it doesn't exist. Return only public columns, not the owner.

## 4. API routes (`apps/bff/src/routes/api.ts`)

Declare each route with `createRoute` (method, path, `operationId`, request
schemas, every response status), and register it on `userApi`, which checks
the session (401). Bad input gets 400 from the default hook; an unknown or
someone else's record is 404. Limit anything that sends email or costs money
with `hit()` from `apps/bff/src/rate-limit.ts`.

## 5. Client (`packages/api`)

Run `yarn api:generate`. It writes `packages/api/openapi.json` from the routes
and regenerates the typed client, TanStack Query hooks and MSW mocks. Commit
the result; `yarn verify` fails if it's stale. Never write API types by hand.

## 6. UI (`packages/feature-<name>`)

- A new feature package gets its own `package.json` (deps on `@booking/core`,
  `@booking/api`, `@booking/ui` only), a short `AGENTS.md`, and an entry in
  `scripts/check-boundaries.ts` if its name doesn't match `@booking/feature-*`.
- Read with the generated `useX` hooks; pass `throwOnError: throwUnexpected()`
  so unexpected errors reach the route's error page.
- Mutate with the generated mutation hooks, then invalidate the list's query
  key (`getXQueryKey()`).
- Forms: React Hook Form with `zodResolver(<schema from core>)` and the
  `Field`, `FieldLabel`, `FieldError`, `Input` components from `@booking/ui`.
- URL state, such as filters, lives in the route's search params, not React
  state. Client state that isn't server data goes in Zustand (ask first: it
  isn't installed yet).
- Use the `new-page` skill to add the route in `apps/web`.

## 7. Tests

- Component tests next to the component (`*.test.tsx`, Vitest + Testing
  Library), with handlers from `@booking/api/mocks` fixed to known data.
- API cases in `e2e/api.spec.ts`, including invalid input and unknown records.
- Browser tests for the user flow, the pending state and the failure path.
  They also run axe: fix any violation.
- A `createX` helper in `e2e/support.ts` that produces unique values.
- Update `packages/db/src/seed.ts` if demo data helps.

## 8. Finish

- Run `yarn verify` and `yarn test`.
- Break the feature once to confirm the new tests fail, then revert.
- Check it in the running app with the `run-app` skill.
- Have the change reviewed (the `reviewer` subagent in Claude Code).
- Update the README for new commands, variables or concepts.
- Say plainly whether the new data is per user or shared by everyone.
