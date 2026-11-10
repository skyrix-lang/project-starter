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

- [ ] `<title>`, description (about 150 characters), canonical, `og:*` and
      JSON-LD describe the home page, with `PUBLIC_URL`, never `localhost` or
      a literal `%PUBLIC_URL%`.
- [ ] No `noindex` in the shell: app pages add it at runtime.

## Every public page

- [ ] Listed in `PUBLIC_PATHS` (`packages/core/src/site.ts`), so in `sitemap.xml`.
- [ ] Its own title through `usePageMeta`, and no `noindex`.
- [ ] One `h1`, no skipped headings, and `alt` text on images.
- [ ] Main content renders without waiting for a signed-in API call.
- [ ] Internal links use `<Link>`, and none go to `#`.
- [ ] If it must rank on more than the home page's metadata, raise prerendering
      (see `docs/decisions.md`, "Client-only SPA").

## Site-wide

- [ ] `robots.txt` allows public pages, blocks `/api/` and `/auth/`, and names
      the sitemap.
- [ ] Unknown URLs show the not-found page with `noindex` (the SPA answers 200).
- [ ] Every app page has `noindex` and is out of the sitemap.
- [ ] `packages/core/src/site.ts` and `index.html` hold the real name and
      description.

## Report

Fix what's clearly wrong, and add a test to `e2e/seo.spec.ts` for each fix. List
what needs a human: real copy, legal pages and Search Console.
