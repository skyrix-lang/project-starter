---
name: seo-check
description: Audit this project's SEO and fix what's missing, including the HTML shell's metadata, canonical URL, sitemap, robots, Open Graph, structured data and per-page titles. Use when asked to check or improve SEO, or before launching public pages.
---

# Check SEO

The app is a client-rendered SPA. Crawlers first read `apps/web/index.html`, as
served by the BFF with `%PUBLIC_URL%` filled in, then the page after JavaScript.
Check both, against a production build:

```bash
yarn db:up && yarn keycloak:up && yarn build
PUBLIC_URL=https://example.com PORT=3101 yarn start
curl -s http://localhost:3101/ ; curl -s http://localhost:3101/robots.txt
```

## The HTML shell (what every URL returns first)

- [ ] `<title>`, description (about 150 characters), canonical, `og:*`,
      `twitter:*` and JSON-LD describe the home page, with `PUBLIC_URL`, never
      `localhost` or a literal `%PUBLIC_URL%`.
- [ ] `og:image` is the project's own image (`apps/web/public/og-image.png`,
      1200 × 630), not the starter's.
- [ ] No `noindex` in the shell: app pages add it at runtime.

## Every public page

- [ ] Listed in `PUBLIC_PATHS` (`packages/core/src/site.ts`), so in `sitemap.xml`.
- [ ] Its own title and description through `usePageMeta`, an image if it
      has one, `jsonLd` where schema.org has a type for it, and no `noindex`.
- [ ] One `h1`, no skipped headings, and `alt` text on images.
- [ ] Main content renders without waiting for a signed-in API call.
- [ ] Internal links use `<Link>`, and none go to `#`.
- [ ] If it must rank on more than the home page's metadata, raise prerendering
      (see `docs/decisions.md`, "Client-only SPA").

## Site-wide

- [ ] `robots.txt` allows public pages, blocks `/api/` and `/auth/`, and names
      the sitemap. App pages stay allowed: their `noindex` only works if
      crawlers can load them.
- [ ] The sitemap's addresses match the canonical links (the home page with
      its trailing slash).
- [ ] Text files are served compressed (`curl -sI -H 'Accept-Encoding: br'`
      on a script shows `content-encoding: br`).
- [ ] Unknown URLs answer 404 with the not-found page and `noindex`
      (`curl -sI <PUBLIC_URL>/no-such-page`). A route's own "not found" (a
      missing record) answers 200: it must render the not-found page too.
- [ ] `www.` and the bare domain both reach the site, and the one that isn't
      `PUBLIC_URL` redirects to it (301).
- [ ] `favicon.ico`, `apple-touch-icon.png` and the Organization logo in
      `index.html`'s JSON-LD are the project's own, made from its icon.
- [ ] Every app page has `noindex` and is out of the sitemap.
- [ ] `packages/core/src/site.ts` and `index.html` hold the real name and
      description.

## Report

Fix what's clearly wrong, and add a test to `e2e/seo.spec.ts` for each fix. List
what needs a human: real copy, legal pages and Search Console.
