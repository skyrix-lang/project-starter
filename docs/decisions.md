# Decisions

Choices made on purpose, with the reason and when to reconsider them. Don't reverse
one as a side effect of other work: propose it, and record the outcome here. New
decisions go at the end.

## Client-only SPA and a BFF

React 19 + Vite builds static files; a small Hono server (the BFF) serves them,
handles sign-in and sessions, and owns the JSON API and the database. No server
rendering.
**Why:** request-time server rendering has had critical vulnerabilities in
2025-2026 (remote code execution, middleware bypass, cache poisoning) that
can't apply to static files; one image per customer is simple to configure at
start; and React with typed routes is what coding agents handle best.
**Cost:** public pages are client-rendered. Crawlers get `index.html`'s metadata
first; a page that must rank on its own content needs prerendering.
**Revisit when:** public content must rank beyond the home page: prerender those
routes (React Router 8 with `ssr: false` prerendering, or a static generator)
rather than adding a request-time server renderer.

## Versioned packages plus a thin app per customer

`packages/*` hold the core, the generated API client, the UI kit, features and
a theme; `apps/web` composes them, adds routes and declares typed page
overrides (`apps/web/src/overrides.ts`) at build time. Packages export their
TypeScript source and are consumed through Yarn workspaces for now.
`scripts/check-boundaries.ts` enforces which package may import which, and that
each declares what it imports.
**Why:** one core serves many customer projects, and each upgrades by bumping
package versions instead of merging changes into a copy: semver sits on the
customization surface.
**Revisit when:** a customer project lives in its own repository: publish the
packages to a private registry with a build step and changesets. Skip
micro-frontends unless customers must ship pages without a rebuild.

## OIDC confidential client in the BFF

The BFF signs users in with OpenID Connect (authorization code + PKCE, state and
nonce) as a confidential client, using `openid-client`. Users are identified by
issuer and subject; sessions are rows in `user_sessions` holding a hash of the
cookie's token, so deleting a row signs out at once. The browser only holds an
HttpOnly, SameSite=Lax cookie (`__Host-` on https). Signing out also ends the
provider's session. Local development and tests use Keycloak in Docker
(`docker/keycloak/realm.json`); production uses the customer's provider.
A user created ahead of their first sign-in (by email, with no identity yet)
is linked when the provider has verified that email, not duplicated.
**Why:** the IETF guidance for browser apps (RFC 10017) recommends against
tokens in the browser for apps handling personal data, and a client secret
must never be in the bundle.
**Open:** sessions last 30 days and aren't rechecked with the provider, so a
user disabled there stays signed in until expiry. Add a shorter or sliding
expiry, a refresh-token check, or back-channel logout when a customer needs it.

## Data belongs to a user

Every row of per-user data has a `user_id`. Every BFF data function takes the
signed-in user's id and filters by it, and another user's row behaves as if it
doesn't exist (404). The owner column isn't returned.
**Why:** the check lives in one place per query, not in each caller, and a missing
filter shows up in review as an unused argument.
**Revisit when:** something needs sharing or roles: add them explicitly, don't
loosen the filter.

## TanStack Query through a generated client

The BFF's routes are declared with `@hono/zod-openapi`, which produces
`/api/openapi.json`. Orval generates the typed client, TanStack Query hooks and
MSW mocks into `packages/api` (`yarn api:generate`); `yarn api:check` in
`yarn verify` fails when either is stale. Zustand is the client-state library,
added with the first feature that needs client-only state.
**Why:** a wrong field or route is a compile error instead of a runtime one, and
agents never hand-write API types.

## Postgres with Drizzle, migrations as committed SQL

`yarn db:generate` writes SQL from `packages/db/src/schema.ts` into
`packages/db/drizzle/`. It's reviewed and committed, never edited once applied,
and run as a deploy step (the image's `migrate` stage), not at startup.
**Why:** the SQL that runs in production is the SQL that was reviewed, and a
failed migration stops a deploy rather than a running app.

## Rate limits in Postgres

Fixed-window counters in the `rate_limits` table (`apps/bff/src/rate-limit.ts`).
**Why:** no extra service such as Redis, and every instance shares the counts.
**Revisit when:** something rate-limited is hot enough that a row write per hit
matters. The client address comes from `x-forwarded-for`, so deploy behind a
proxy that sets it.

## Environment checked at startup

`apps/bff/src/env.ts` validates with Zod. `apps/bff/src/server.ts` runs it when
the server starts, and exits on failure. Nothing is read at build time, so one
image serves any customer and domain.
**Why:** a bad deploy fails where it's deployed, not on the first request.

## Strict CSP set by the BFF

`script-src 'self'` with no `'unsafe-inline'`: Vite emits no inline scripts.
`form-action` allows the identity provider, for sign-out. Set in
`apps/bff/src/app.ts` with Hono's `secureHeaders`.
**Why:** the strongest policy that costs nothing when nothing is
server-rendered.
**Revisit when:** a provider's `end_session_endpoint` isn't on the issuer's
host: add its origin to `form-action`.

## Vitest, MSW and Playwright with axe

Vitest runs unit tests (node) and component tests (jsdom, Testing Library,
MSW handlers from the generated mocks; unhandled requests fail). Playwright runs
against the production bundle with real Postgres and Keycloak, and every test
also fails on a console error or an axe WCAG 2.2 AA violation.
**Why:** fast feedback that makes agent-written code trustworthy, and the
European Accessibility Act covers e-commerce and e-ticketing.

## oxlint and oxfmt, not ESLint and Prettier

Lint is type-aware (`oxlint --type-aware`, with `oxlint-tsgolint`).
**Why:** much faster, one toolchain (oxc.rs), enough rules for this project.

## Yarn supply-chain settings

`.yarnrc.yml` disables install scripts and refuses versions published less than
7 days ago; CI installs with `--immutable`; Renovate waits 7 days too. Release
images carry an SBOM and provenance and are signed with cosign; `SECURITY.md`
is the disclosure policy.
**Why:** npm worms kept arriving through 2026, and the Cyber Resilience Act
expects SBOMs and vulnerability handling for delivered software.
**Revisit when:** a dependency truly needs its install script: allow that one
package in `dependenciesMeta`, never globally.

## Each checkout is isolated

The main checkout uses ports 3000 (Vite) and 3001 (BFF) and the `booking`
database. A git worktree gets its own dev ports, dev database and e2e port and
database (`scripts/checkout.ts`, `yarn setup`). Postgres and Keycloak are shared.
**Why:** several agents can work in parallel worktrees without one's migrations or
test reset breaking another's.

## Node 24, pinned in three places

`.nvmrc` (local and CI), the base image in `docker/Dockerfile` (by digest) and
the BFF's build target in `apps/bff/vite.config.ts` name the same major version.
**Why:** an even-numbered release in long-term support, with security fixes
until April 2028, and it still ships Corepack, which provides Yarn.
**Revisit when:** moving to Node 26 or later: Corepack is no longer bundled, so
the image and CI must install it (or Yarn) themselves. Change all three together.

## Structured logs on stdout, without a library

`apps/bff/src/log.ts` writes one JSON line per event in production and text in
development, with a request id carried by `AsyncLocalStorage` and returned as
`x-request-id`. Requests are logged with their path only, and errors with their
message, code and stack only.
**Why:** a container's platform collects stdout and can filter JSON by level or
request id; a query string can carry a sign-in code, and libraries attach
query parameters and token responses to their errors; and one small file needs
no dependency.
**Revisit when:** traces or metrics are needed, or a second service must share
a request's id: add OpenTelemetry then, and keep `log` as the one entry point.

## Compose file for trying the image, not for production

`docker/compose.yaml` runs the image with Postgres, the migration stage and a
development Keycloak, in deploy order. Keycloak is reached as
`keycloak.localhost` on the same port by the browser and by the app, because
the issuer must be one address for both.
**Why:** the image is what ships, so there must be a one-command way to run it
as it runs in production. Its secrets are public: it is not a deployment.

## Projects follow the starter

Projects are copies of the starter (`yarn rename`), not forks or packages.
Renovate updates versions in every repository with one shared policy
(`default.json`, a preset each `renovate.json` extends), and
`yarn sync-from-starter` merges the starter's other changes into a project,
file by file, with `yarn rename`'s rules applied. See `docs/starter-sync.md`.
**Why:** a shared tooling package can't carry CI, Docker or app code, and
needs a registry and releases for every change; merging the starter as a git
remote conflicts on every renamed line. Renovate replaced Dependabot because
Dependabot can't share a config between repositories.
Pull requests merge themselves once CI passes (GitHub auto-merge, CI required
on `main`, merge commits only: `scripts/setup-github.sh`): Renovate's
non-major updates, and a sync that applied cleanly, which the starter
triggers as soon as its `main` changes. A sync with conflicts, even ones
Claude resolved, and Renovate majors wait for a person.
**Why (auto-merge):** one person maintains the starter and its projects; a
clean, green sync is the starter's reviewed change arriving unchanged, while a
resolved conflict is a judgement call CI can't check.
**Revisit when:** there are more than about five active projects, or parts of
the starter (`ui`, `core`) stop changing per project: publish those as
packages.

## Mail over SMTP, logged when unconfigured

The BFF sends mail with Nodemailer through any SMTP server (Scaleway
Transactional Email for now), configured by `SMTP_*` and `MAIL_FROM` at
start. Without `SMTP_HOST` mail is logged and dropped; Vitest and the e2e
run empty it, so tests can't reach a real inbox.
**Why:** SMTP keeps the provider swappable without code changes, and one
switch (is a server set?) is simpler to trust than a per-environment rule.
**Revisit when:** a test must read a mail's content (a sign-in or invitation
link): add a local catcher such as Mailpit to the dev containers and point
the e2e run's `SMTP_HOST` at it, or when a provider's HTTP API is needed
(templates, bounces, webhooks).

## Deploys ship in the starter, off until turned on

The starter carries the whole deploy (`yarn deploy`, the server scripts,
`docker/compose.production.yaml`, the nightly `Deploy` workflow), first built
for zbeul. Nothing runs until a project sets the `DEPLOY_SSH` variable. Every
night around 02:00 (Paris), the workflow deploys the commit the nightly just
checked if the server doesn't run it yet and every check passed (see "A
nightly gates the deploy"); each deploy stops the app, backs the database up
to Cloudflare R2 and proves the backup restores before migrating, and a
failed migration, health check or public https check restores the database
(only if a migration ran) and starts the previous image. Nights without a
deploy back up all the same.
**Why:** each project would otherwise rebuild the same scripts, and drift;
shipped in the starter, a fix reaches every project with the next sync. At
02:00 nobody uses the app, so stopping it for a minute makes the backup
exact: nothing written between backup and rollback is lost. R2 has no egress
fees and an S3 API. Building on the server needs no registry.
**Revisit when:** a project is used at night or its database takes minutes
to dump (migrate without stopping, point-in-time recovery), or a project
deploys somewhere other than one Docker server.

## Google Analytics behind a consent banner, off by default

GA4 is turned on by setting `GA_MEASUREMENT_ID` when the server starts; the
BFF writes it into `index.html` (a `meta` tag, no extra request) and only then
adds Google's origins to the CSP. Google's library is loaded by the app's own
script once a visitor accepts in the banner, never before, so there is no
inline script and no cookie or request to Google without consent. It starts
with Consent Mode v2 denying everything, then grants `analytics_storage`
only. The choice is kept in `localStorage` for six months, then asked again;
"Cookie settings" in the footer reopens the banner, and declining after
accepting stops measuring and deletes Google's cookies. Declining is a button
like accepting, next to it. Page views of client-side navigations are left to
GA4's enhanced measurement.
**Why:** the ePrivacy rules as the CNIL applies them require consent before
audience-measurement cookies, refusal as easy as acceptance and a way to
withdraw; six months is the CNIL's recommended lifetime for the choice. Loading
the script only after consent (Consent Mode's "basic" setup) sends Google
nothing for visitors who refuse, unlike the "advanced" setup's cookieless
pings. Enhanced measurement already counts history changes; sending page
views from the router as well would count each one twice, unless every
project remembered to turn the history option off in GA's admin. The cost:
such a page view may carry the previous page's title, since the router
changes the address before the page sets its title; its URL is right.
**Revisit when:** a project needs another measurement tool, or one exempt
from consent (a self-hosted, cookieless one such as Matomo configured per the
CNIL's exemption): the banner and the store in `apps/web/src/analytics.ts`
then become generic. Or when advertising needs ad storage: ask for it
separately in the banner.

## Precompressed assets, served by the BFF

A small Vite plugin (`precompress` in `apps/web/vite.config.ts`, on
`node:zlib`) writes brotli and gzip copies of the build's text files at
maximum compression; the BFF serves them with `serveStatic`'s `precompressed`
option and compresses `index.html` once at startup. Every static response
carries `Vary: Accept-Encoding`.
**Why:** compressing at build time costs nothing per request and allows
brotli's strongest level (about 13% smaller than gzip's best on this build), which is
too slow to run per request. Writing the plugin took 40 lines and no new
dependency.
**Revisit when:** a CDN or proxy in front compresses and caches on its own:
the copies then only cost image size.

## Theme contrast checked by a unit test

`scripts/theme-contrast.test.ts` computes WCAG 2.2 contrast for each token
pair the components use (text 4.5:1; input borders, the focus ring, buttons
and invalid borders 3:1), in every `packages/theme-*` package, for light mode
and each dark mode a theme defines (`prefers-color-scheme: dark`, `.dark` or
`[data-theme]`). Its pair lists name the pairs the UI kit draws. The default
theme's `--input` became `#7c8aa0` (3.3:1), from `#cbd5e1` (1.4:1).
**Why:** axe only sees the states the e2e tests reach, in the theme the app
imports; a customer theme, a dark mode or a hover colour isn't checked there.
Text sized as "large" (3:1) isn't assumed, so every text pair is held to 4.5:1.
**Revisit when:** the UI kit draws a new pair (a new token, or a token on a
new background): add it to `scripts/theme-contrast.ts`.

## Texts in react-i18next, English and French

Every text on screen comes from JSON messages files, one per language and
namespace (`app` in `apps/web/src/locales`, one per feature package), loaded
by i18next with react-i18next and bundled, so there is no request and no
flash of keys. Keys are type-checked against the English files and a test
fails when another language misses one. The language is the visitor's choice
from the header, else the first of their browser's languages that the site
offers (`LANGUAGES` in `packages/core/src/site.ts`), else the first one; it
sets `<html lang>`. Dates go through `Intl` in that language. The metadata
crawlers read (`index.html`, the sitemap) stays in the default language.
**Why:** projects are French and English, and the starter's screens (sign-in,
errors, bookings) reach every project through the sync: written once with
keys, each project gets them in its own language. react-i18next is the most
used React i18n library, its JSON works with translation tools, and its
plurals and interpolation are more than a homemade lookup would give for long.
**Revisit when:** a page must rank in several languages: it then needs an
address per language (`/fr/…`) and `hreflang`, which the language-in-storage
choice doesn't give.

## Client state in Zustand, persisted with a version

What the visitor sets in this browser (theme, language) is a Zustand store
saved to `localStorage` with `persist` (`apps/web/src/preferences.ts`), with a
`version` and values checked by Zod as they're read back, so an old or edited
value falls back to its default. Analytics consent keeps its own key, which
has an expiry.
**Why:** Zustand was already the recorded choice for client-only state, and
this was the first need. `persist` gives one pattern for anything a project
must remember, without a hand-written storage layer per feature.

## Dark mode by a class, set before the first paint

A theme's dark colours are a `.dark` block; the app puts the class on
`<html>` when the visitor picks dark, or when the system is dark and they
haven't chosen. `apps/web/public/theme.js`, a small classic script in
`index.html`'s head, reads the stored choice before the page renders.
**Why:** a class (not only `prefers-color-scheme`) lets the visitor override
the system; a script file, not an inline one, keeps the strict CSP; running
before the app's bundle avoids a white flash on every load. The contrast test
reads `.dark` blocks, so the dark palette is held to AA too.

## Toasts from Base UI

`toast()` and `<Toaster>` in `@booking/ui` wrap Base UI's Toast: a polite
announcement for confirmations, an assertive one that stays until closed for
errors. Toasts confirm what just happened; form errors stay in the form.
**Why:** Base UI is already the component base, so no new dependency, and its
toasts handle focus (F6), screen reader announcements and pausing on hover.

## Real 404s for an SPA, from the route tree

The build writes the app's route paths to `routes.json`, read from TanStack
Router's generated route tree (`routesManifest` in `apps/web/vite.config.ts`),
and the BFF answers 404 for any path that matches none, with the app's own
page, which renders "Page not found". Without the file it answers 200
everywhere, as before. The `www.` twin of `PUBLIC_URL`'s host redirects to
`PUBLIC_URL` (301), and only that host: a proxy that passes its upstream name
(`app:3000`) or an address must not loop.
**Why:** a 200 for an unknown address is a "soft 404" to Google, and a typo
or an old link looks like a page. The route tree is the single source of
routes, so nothing is listed twice. Redirecting only the `www.` twin covers
the usual duplicate without trusting the `Host` header beyond it.
**Revisit when:** routes are prerendered (see "Client-only SPA"): the static
pages then carry their own status. Or a route can tell from the URL alone
that its record doesn't exist (a slug list known at build time).

## A short README, with the guides in docs/

`README.md` holds what the project is, a quick start and a table of the
guides; each topic has its own page in `docs/` (architecture, development,
configuration, customizing, SEO and analytics, security, deployment, beside
new-project, auto-deploy and starter-sync). Scripts, workflows and
`.env.example` point to the page and section. **Why:** one 500-line README was
hard to read, and an agent that needed one section read all of it; a page per
topic is read only when needed. **Revisit when:** a page grows past one topic:
split it again rather than growing the README.

## Typography and layout are theme tokens

Besides colours, the theme sets the heading font, weight and letter spacing,
the content and text widths and the section spacing. `packages/ui` turns them
into `text-display`, `text-h1`/`h2`/`h3`, `text-lead`, `page-container`,
`page-section` and `prose-width`, and `scripts/heading-sizes.test.ts` (in
`yarn verify`) fails on a raw `text-2xl` or larger on an h1 to h3. Each page
lays itself out (`page-section` > `page-container`); the root layout no longer
wraps pages in a container. **Why:** pages chose their own sizes and drifted;
an agent building a page from a design needs one vocabulary, and a brand
changes the look in one file. Sections own their container so one can span
the full width with its own background. The utilities fall back to the
default values, so a theme made before the tokens keeps working, and `cn()`
knows the type utilities are sizes. `scripts/page-layout.test.ts` fails on a
page without `page-section`, so a page left without the old container is
caught rather than shown edge to edge.

A project syncing this: wrap each of its own pages (routes, page overrides,
its features' `*-page.tsx`) in `page-section` > `page-container`, remove any
container its layout routes add, and move its headings to the nearest
utility. Heading weight and tracking may change: have a person look at the
pages before merging. **Revisit when:** a page needs a size the scale doesn't
have: add a utility rather than a raw size.

## A design record per brand, written with the design skill

`docs/design.md` records what a brand does with the tokens (brief, direction,
type, section patterns, do's and don'ts, pages), and agents read it before
building a page. The `design` skill writes it with the person: brief and
references, two or three directions as throwaway pages on the theme's token
names, then the theme, global layout and pages. `yarn sync-from-starter` adds
the starter's copy (the default brand) once, on the sync that brings it, and
never changes or restores it after (`SEED_ONLY`). **Why:** tokens give one
vocabulary, but not the choices made with it; without a record each page
re-derives the brand from CSS. Mockups are agreed before code, but the result lives in the theme
and the real pages, not in mockup files. **Revisit when:** projects keep
design records elsewhere (a design tool), or several brands share one
repository.

## GitHub's runners, or your own with one variable

Every workflow job runs on `${{ vars.RUNNER || 'ubuntu-latest' }}`: GitHub's
runners unless the repository sets `RUNNER` to the label of its self-hosted
runners (docs/development.md, "CI"). The nightly deploy always stays on
GitHub's runners. **Why:** private repositories on GitHub Free get few
hosted minutes, and a project with its own server can run its CI there; one
variable keeps the workflows the same in every project, so syncs don't undo
it. The deploy job writes an SSH key and known hosts into the runner's home,
which a self-hosted runner shares between jobs and repositories. **Revisit
when:** a project needs a different runner per job, or the deploy key can be
kept out of the runner's home.

## A nightly gates the deploy

Every night at 01:30 (Paris) the `Nightly` workflow runs CI itself on
`main`, plus coverage of the unit and e2e tests together with minimums that
only go up (see "Coverage counts the e2e tests"), Playwright in Firefox
and WebKit with no retries, and a dependency audit. The deploy that follows
deploys the commit it checked only if everything passed, and backs up either
way. A red night opens one `nightly` issue, and while it's open the pull
requests that merge themselves (Renovate's, the starter's sync) wait.
Releases, Claude's fix and deploying the CI image follow
(`docs/specs/nightly-and-release.md`).
**Why:** changes reach production without a person reading each one, so the
gate before production must be the most thorough run, not the quickest; a
pull request stays fast with Chromium and retries. Flaws in dependencies
appear without a code change, which only a scheduled run catches. A failure
nobody sees is the main risk, hence one issue rather than a red run in
Actions, and no new changes merged on top of it. The nightly calls CI rather
than copying it, so the two never drift. Renaming `ci.yml` to `verify.yml`
was rejected: the deploy and the required checks know it by name, and every
project would get the rename for nothing.
**Revisit when:** the nightly takes too long to finish before 02:00, or a
project on GitHub's runners runs out of minutes: run the full suite only on
nights when `main` changed.

## Coverage counts the e2e tests

`yarn test:coverage` merges the coverage of the Vitest suites with the
Playwright tests' (the browser's in Chromium, the BFF's through
`NODE_V8_COVERAGE`), by source file, with monocart-coverage-reports, and
checks it against `coverage-minimums.json`, which each project owns.
Whole journeys are e2e scenarios (`*.scenario.spec.ts`, the `e2e-scenario`
skill).
**Why:** most of an app's code (screens, routes, the BFF's handlers) is
proven by the e2e tests, so a unit-only figure says little and pushes towards
unit tests of code that a journey already proves. The minimums differ per
project, so they live in a file the sync seeds once and never changes,
rather than in `vitest.config.ts`, which it updates. Chromium only: the other
browsers run the same code.
A file's totals depend on which compile loaded it (Vitest's or the
build's), so the figures are stable from run to run but not exact
per file (docs/development.md, "Coverage").
**Revisit when:** the e2e run with coverage gets much slower than without, a
project needs coverage per package, or that limit makes a ratchet fail for
adding a test.
