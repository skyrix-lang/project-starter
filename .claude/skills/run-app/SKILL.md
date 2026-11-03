---
name: run-app
description: Start this project's dev server, sign in without email, and check a change in the running app (pages, API, Server Actions, runtime errors). Use to see a change working, reproduce a bug, take a look at a page, or debug an error that tests don't explain.
---

# Run the app and check a change

Tests prove behaviour; this is for seeing it. Use it while building, then still
finish with `yarn verify` and `yarn test`.

## 1. Find or start the dev server

- `.next/dev/lock` holds the PID and URL of this checkout's running server. If
  it exists and the URL answers, use it: don't start a second one.
- Otherwise run `yarn dev` in the background and wait until
  `curl -sf <url>/api/health` succeeds. The port is 3000, or `PORT` from `.env` in
  a worktree (`yarn setup` sets it).
- Fresh checkout or worktree: run `yarn install && yarn setup` first. It creates
  `.env`, starts Postgres and Mailpit, creates the database and migrates it.
- Pending migrations: `yarn db:migrate`. Don't read `.env`: it holds secrets.

## 2. Sign in

`yarn dev:session [email] [--seed]` creates a session directly in the local
database and prints the cookie. The default user is `agent@example.test`.
`--seed` gives that user the demo bookings. It refuses non-local databases.

```bash
yarn dev:session --seed
curl -H 'Cookie: authjs.session-token=<token>' http://localhost:3000/bookings
```

For a browser, use the cookie, or `storageState: "e2e/.auth/dev-session.json"` in
a Playwright script. To test the real sign-in flow instead, request a link on
`/sign-in` and read it from Mailpit: `curl 'http://localhost:8025/api/v1/search?query=to:"<email>"'`.

## 3. Look

- **HTML:** `curl` the page. App pages stream, so the content arrives after the
  skeleton, in the same response. A `NEXT_REDIRECT` in the body means a redirect,
  usually to `/sign-in`: check the cookie.
- **API:** `curl` the Route Handler with the cookie and `-H 'content-type: application/json'`.
- **In a browser:** a short Playwright script with the storage state, or a
  browser tool if you have one. Check the browser console too: CSP violations and
  hydration errors show up there, and they fail the e2e tests.
- **Runtime errors and routes:** the `next-devtools` MCP server (`.mcp.json`),
  or POST JSON-RPC to `<url>/_next/mcp` yourself: `get_errors`, `get_routes`,
  `get_logs`, `get_compilation_issues`, `compile_route`.
- **Server output:** wherever `yarn dev` writes. Read it after each request:
  warnings there are bugs too.

## 4. Clean up

Stop the server you started (`kill <pid>` from `.next/dev/lock`), not one that
was already running. Leave the database: it's per checkout.
