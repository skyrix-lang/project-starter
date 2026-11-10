# apps/bff: backend-for-frontend

Hono on Node. Owns sign-in (OIDC confidential client), sessions, the JSON API,
security headers and serving the built SPA. Bundled into one file for the image.

- API routes: `createRoute` + Zod in `src/routes/api.ts`, then `yarn api:generate`.
- Per-user data: every data function takes the user's id and filters by it.
- Read settings with `env()` (`src/env.ts`), never `process.env`.
- Log with `log` (`src/log.ts`), never `console`; no secrets or query strings.
- `src/app.test.ts` covers what needs no database; the rest is in `e2e/`.
