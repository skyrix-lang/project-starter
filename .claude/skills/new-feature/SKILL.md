---
name: new-feature
description: Build a full-stack feature in this project across the database, data layer, Server Actions, API and UI, with migrations and Playwright tests. Use for new features, new entities, new forms, or changes to the database schema.
---

# Build a feature

Work from the database up, and include only the layers the feature needs.
`src/app/bookings/` and `src/lib/bookings.ts` show every layer.

## 1. Database

1. Edit `src/lib/db/schema.ts`, using real column types.
2. Run `yarn db:up`, then `yarn db:generate --name=<what_changed>`.
3. Read the SQL in `drizzle/`. Check that existing rows survive it: a new
   `NOT NULL` column needs a default, and a rename can be generated as drop and add.
4. Run `yarn db:migrate`. Never edit a migration that has already been applied.
5. Enforce rules in the database where possible, such as unique or foreign keys.

## 2. Validation

Add Zod schemas to `src/lib/<entity>-schema.ts`, so actions and routes share them.
Export inferred types.

## 3. Data layer

Add `src/lib/<entity>.ts`, starting with `import "server-only"`. Export small async
functions that use `getDb()`. Put no HTTP or React code here. For per-user data,
give the table a `user_id` and make each function take the user's id and filter
by it, as `src/lib/bookings.ts` does: another user's row then behaves as if it
doesn't exist. Return only public columns, not the owner.

## 4. Server Actions

For UI mutations, add `src/app/<route>/actions.ts` with `"use server"`:

- Validate every argument, because actions are public endpoints.
- Call `requireUser(returnTo)` from `src/lib/session.ts` first in each action.
- Call `revalidatePath` after writing.
- Return expected failures. Use `useActionState` when a form must show them. Throw
  only for unexpected errors.
- Use `useFormStatus` for pending state, as in `src/components/ui/SubmitButton.tsx`.

## 5. Route Handlers

Add these only if something outside the UI needs the JSON API. See
`src/app/api/bookings/`: return 401 when `getUser()` is null, `safeParse` input,
return 400 for bad input and 404 for unknown records, and call `revalidatePath`
after writes.

## 6. UI

Read data in a Server Component and pass it down. Use the `new-page` skill for any
new route. Keep URL-based state, such as filters, in `searchParams` with `<Link>`.

## 7. Tests

- Add API cases to `e2e/api.spec.ts`, including invalid input and unknown records.
- Add browser tests for the user flow, the pending state and the failure path.
- Add a `createX` helper to `e2e/support.ts` that produces unique values.
- Add `node:test` unit tests next to new pure logic, such as Zod schemas.
- Update `src/lib/db/seed.ts` if demo data helps.

## 8. Finish

- Run `yarn format`, then `yarn check`, `yarn lint`, `yarn test:unit` and `yarn test`.
- Break the feature once to confirm the new tests fail, then revert.
- Update the README for new commands, variables or concepts.
- Say plainly whether the new data is per user or shared by everyone.
