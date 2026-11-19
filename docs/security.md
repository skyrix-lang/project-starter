# Security

How sign-in, sessions, headers and the supply chain are protected.

- Sign-in uses OIDC with PKCE through a confidential client. Sessions are
  server-side, the cookie is HttpOnly and SameSite=Lax (`__Host-` on https),
  and only a hash of the session token is stored.
- The CSP allows scripts from `'self'` only, with no `'unsafe-inline'` (plus
  Google's, when [analytics](seo-and-analytics.md#analytics) is turned on). The
  other headers are HSTS, `X-Frame-Options: DENY`, `nosniff` and a strict
  referrer policy (`apps/bff/src/app.ts`). Add third-party origins there.
- The CSRF check refuses cross-site form posts. There is no CORS, so other
  origins can't send JSON.
- Sign-ins are rate limited per client address (`apps/bff/src/rate-limit.ts`).
- Supply chain: install scripts are disabled, versions younger than 7 days are
  refused, CI installs from the lockfile only, and Renovate waits 7 days too.
