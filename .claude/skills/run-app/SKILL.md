---
name: run-app
description: Start this project's dev servers (Vite + BFF), sign in without Keycloak, and check a change in the running app (pages, API, runtime errors). Use to see a change working, reproduce a bug, take a look at a page, or debug an error that tests don't explain.
---

# Run the app and check a change

Tests prove behaviour; this is for seeing it. Use it while building, then still
finish with `yarn verify` and `yarn test`.

## 1. Find or start the dev servers

- If `curl -sf <PUBLIC_URL>/api/health` answers (http://localhost:3000, or
  `WEB_PORT` in a worktree), it's running: don't start a second one.
- Otherwise run `yarn dev` in the background. It starts the BFF (`tsx watch`,
  port `PORT`, 3001) and Vite (`WEB_PORT`, 3000), which forwards `/api` and
  `/auth` to the BFF. Wait for the health check.
- Fresh checkout or worktree: `yarn install && yarn setup` first. It creates
  `.env`, starts Postgres and Keycloak, creates the database and migrates it.
- Pending migrations: `yarn db:migrate`. Don't read `.env`: it holds secrets.

## 2. Sign in

`yarn dev:session [email] [--seed]` creates a session directly in the local
database and prints the cookie. The default user is `agent@example.test`;
`--seed` gives it the demo bookings. It refuses non-local databases.

```bash
yarn dev:session --seed
curl -H 'Cookie: session=<token>' http://localhost:3000/api/bookings
```

For a browser, use `storageState: "e2e/.auth/dev-session.json"` in a Playwright
script. For the real flow, open `/sign-in` and log in on Keycloak as `ada` /
`ada` or `grace` / `grace` (admin console http://localhost:8180, admin/admin).

## 3. Look

- **Pages:** the HTML is the same shell for every route; look in a browser
  (Playwright script or a browser tool). Check the console: CSP violations,
  React errors and failed requests show there, and fail the e2e tests.
- **API:** `curl` with the cookie and `-H 'content-type: application/json'`.
  The contract is `GET /api/openapi.json`.
- **Server output:** wherever `yarn dev` writes, for both processes. Read it
  after each request: warnings there are bugs too.

## 4. Clean up

Stop the `yarn dev` you started, not one that was already running. Leave the
database: it's per checkout.
