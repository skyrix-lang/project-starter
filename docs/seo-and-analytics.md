# SEO, analytics and compression

What search engines and link previews see, Google Analytics behind a consent banner, and compressed assets.

## SEO

The app renders in the browser. Every URL first returns `apps/web/index.html`,
and the BFF fills in `PUBLIC_URL` when it serves it. That file carries the home
page's title, description, canonical URL, Open Graph tags and JSON-LD.
`robots.txt` and `sitemap.xml` are built from `PUBLIC_URL`. The pages listed in
`PUBLIC_PATHS` (`packages/core/src/site.ts`) appear in the sitemap. App pages
add `noindex` when they render. A public page that has to rank on its own
content needs prerendering (see `docs/decisions.md`).

Unknown addresses answer 404: the build writes the app's routes to
`routes.json` (from TanStack Router's route tree), and the BFF sends the
app's page, which shows "Page not found", with a 404 status for any path that
matches none. A route that exists but finds nothing (a missing record) still
answers 200, so its page says `noindex` too.

The `www.` twin of `PUBLIC_URL`'s host (or the bare domain, when
`PUBLIC_URL` has `www.`) redirects to `PUBLIC_URL` with a 301, so the site
isn't indexed twice. Point both names at the server, through a proxy that
keeps the request's `Host` header (nginx-proxy does): other hosts are left
alone, since a proxy may pass its own name.

`index.html`'s JSON-LD describes the site and the organisation behind it,
with its logo (`apple-touch-icon.png`), which search results may show.

Link previews use Open Graph and X's card tags: title, description, URL, site
name, locale and a share image (`apps/web/public/og-image.png`, 1200 × 630).
Each page passes its own to `usePageMeta` (`apps/web/src/page-meta.ts`):
`title`, `description`, `image`, `imageAlt`, `type`, and `jsonLd` for
structured data such as an `Event` or a `FAQPage`. Platforms that don't run
JavaScript (most link previews) see the home page's tags from `index.html`.

## Analytics

Google Analytics 4 is off until `GA_MEASUREMENT_ID` is set (`G-` and the id
from the GA property's web stream). Then:

- the BFF writes the id into `index.html` and adds Google's origins to the
  CSP (script, image and connect sources only, never `'unsafe-inline'`);
- a banner asks visitors whether they accept. Nothing is loaded from Google
  and no cookie is set until they do. The choice is kept in the browser for
  six months, then asked again, and "Cookie settings" in the footer changes it;
- Google's library starts with Consent Mode v2 denying everything, then
  grants analytics storage only. Advertising storage stays denied;
- page views of client-side navigations come from GA4's enhanced measurement
  ("Page changes based on browser history events", on by default). Leave it
  on, or pages after the first aren't counted. Such a page view can carry the
  previous page's title (the URL is right): the router changes the address
  before the page sets its title;
- turning on Google Signals in GA's admin makes the library call more of
  Google's hosts (`stats.g.doubleclick.net`, `www.google.com`): add them to
  the CSP in `apps/bff/src/app.ts` first, or the browser blocks them.

Before turning it on, describe it in the site's privacy policy (the footer's
"Privacy" link). The banner's text is in
`apps/web/src/components/consent-banner.tsx`.

## Compression

`yarn build` writes a brotli (`.br`) and a gzip (`.gz`) copy of each text file
of the SPA (`apps/web/vite.config.ts`). The BFF sends the smallest copy the
browser accepts, with `Content-Encoding` and `Vary: Accept-Encoding`, and
compresses `index.html` once when it starts. A proxy in front need not
compress again: nginx leaves a response that already has an encoding alone.
