# Development

Running the app on your machine, the commands, and the tests.

## Getting started

Requires Node 24 (`.nvmrc`), Corepack (`corepack enable`) and Docker.

```bash
yarn install
yarn setup        # .env, Postgres, Keycloak, database and migrations
yarn dev          # http://localhost:3000
```

Sign in as `ada` / `ada` or `grace` / `grace` on the local Keycloak. Then run
`yarn db:seed ada@example.test` to give that user demo bookings. Keycloak's
admin console is at http://localhost:8180 (admin / admin).

`yarn dev` runs the BFF (port 3001, restarts on change) and Vite (port 3000).
Vite forwards `/api` and `/auth` to the BFF, so the browser sees a single
origin, as in production.

## Scripts

| Command                                           | What it does                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `yarn dev`                                        | BFF and Vite dev servers                                                  |
| `yarn build` / `yarn start`                       | production build; serve it with the BFF                                   |
| `yarn verify`                                     | format, types, type-aware lint, boundaries, API contract, unit tests      |
| `yarn test`                                       | Playwright against the production build (Postgres and Keycloak in Docker) |
| `yarn test:unit` / `yarn test:watch`              | Vitest                                                                    |
| `yarn api:generate`                               | OpenAPI document from the BFF's routes, then client, hooks and mocks      |
| `yarn setup`                                      | prepare a checkout or worktree                                            |
| `yarn rename <name> ["Display Name"]`             | once, in a new project: replace the starter's name everywhere             |
| `yarn sync-from-starter [--dry-run]`              | in a project: merge in what changed in the starter since the last sync    |
| `yarn dev:session [email] [--seed]`               | sign in locally without Keycloak, print the cookie                        |
| `yarn db:generate --name=<x>` / `yarn db:migrate` | new migration / apply migrations                                          |
| `yarn db:seed <email>`                            | demo bookings for a user who has signed in                                |
| `yarn db:up` / `yarn keycloak:up`                 | start the local containers                                                |
| `yarn docker:build`                               | build the image                                                           |
| `yarn docker:up` / `yarn docker:down`             | the image with Postgres, migrations and Keycloak (Docker Compose)         |
| `yarn deploy`                                     | ship the current commit to a server, backup first ("Deploying")           |

## Tests

- **Unit and component tests** (`yarn test:unit`) live next to the code. Pure
  logic runs on Node. Components run in jsdom with Testing Library, and every
  request goes to MSW handlers from `@booking/api/mocks`; an unhandled request
  fails the test.
- **End-to-end tests** (`yarn test`) build the app and run it with the bundled
  BFF on its own port and database, signing in through the local Keycloak.
  Every test also fails on a browser console error, or on an axe accessibility
  violation (WCAG 2.2 AA) on the page it ends on. Most tests sign in by writing
  a session row; `e2e/auth.spec.ts` drives the real Keycloak login.

## CI

`.github/workflows/ci.yml` runs `yarn verify` and `yarn test` on every pull
request and on `main`, then builds the image on `main` and on tags. The
workflows run on GitHub's runners (`ubuntu-latest`), unless the repository
variable `RUNNER` names a label of your own self-hosted runners (Settings →
Secrets and variables → Actions → Variables, for example `RUNNER=my-runners`).
Every job then runs there, except the deploy job (`deploy.yml`), which
stays on GitHub's runners: it writes its SSH key into the runner's home, which
every job on a self-hosted runner shares.

What such a runner needs, installed once by an admin, since the workflows
use these before any setup step and the runner has no sudo: Node with
Corepack enabled (CI runs `corepack enable` before `setup-node`), the `gh`
CLI (the sync and notify workflows), git, jq, curl, Docker (rootless is fine)
with the compose and buildx plugins, and the system libraries of Chromium,
Firefox and WebKit (the e2e job installs the browsers without them when it's
not on GitHub's runners, and the nightly uses all three). From any checkout:
`sudo yarn playwright install-deps chromium firefox webkit`. The
e2e jobs of a repository run one at a time there, as they share that Docker's
Postgres and Keycloak containers. Setting up a project in an organization,
private, on such runners: [new-project.md](new-project.md), "In an
organization, private, on your own runners".

### The nightly

`.github/workflows/nightly.yml` runs at 01:30, Paris time, on `main` as it is
then (**Run workflow** in the Actions tab runs it now):

- **CI itself** (`ci.yml`, called with `nightly: true`), with three more
  checks than on a pull request: `yarn test:coverage`, Playwright in Firefox
  and WebKit as well as Chromium (`E2E_BROWSERS=all`), and no retries
  (`E2E_RETRIES=0`), so a flaky test fails here instead of passing on a
  retry. To run the same locally: `E2E_BROWSERS=all E2E_RETRIES=0 yarn test`,
  after `yarn playwright install firefox webkit`.
- **A dependency audit**, `yarn npm audit --all --recursive --severity high`:
  new flaws appear in code that hasn't changed. To accept an advisory with no
  fix yet, add it to `npmAuditIgnoreAdvisories` in `.yarnrc.yml`, with a
  comment saying why and until when.
- **Then the deploy** (`deploy.yml`, [auto-deploy.md](auto-deploy.md)): the
  commit checked is deployed only if everything passed, and the database is
  backed up either way.

A red night opens one issue labelled `nightly`, or comments on the open one,
with each check's result and a link to the run; the next green night closes
it. While it's open, Renovate's pull requests and the sync from the starter
fail CI's "Is the nightly green?" step and don't merge themselves. Renovate's
security fixes (label `security`) aren't held, since one may be what turns it
green, and people's pull requests never are. To merge a held pull request
that fixes it, close the issue: closing it, by hand or on a green night,
runs CI again on the held pull requests (`nightly-closed.yml`,
`scripts/rerun-held.sh`). A cancelled nightly opens no issue and deploys
nothing.

### Coverage

`yarn test:coverage` runs the Vitest suites with coverage, and fails if it
drops below the minimums in `vitest.config.ts` (`coverage.thresholds`). They
started at the level of November 2026. Raise them in the pull request that
raises coverage; never lower them to make a run pass. The report is in
`coverage/index.html`.
