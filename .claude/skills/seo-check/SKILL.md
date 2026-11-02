---
name: seo-check
description: Audit this project's SEO and fix what's missing, including metadata, canonical URLs, sitemap, robots, Open Graph, structured data and static rendering. Use when asked to check or improve SEO, or before launching public pages.
---

# Check SEO

Inspect real output, not just the source. Metadata can be overridden or streamed, so
read what a production server returns.

## Run it

`yarn test` leaves a build containing its test URL, so build first:

```bash
yarn db:up
NEXT_PUBLIC_SITE_URL=https://example.com yarn build
PORT=3101 yarn start
```

Check each route with `curl`, and with a browser for JavaScript-rendered metadata.
Next renames its process to `next-server`, so stop it by the port's PID.

## Every public page

- [ ] Static or cached: `○` in the `yarn build` route table, and no `loading.tsx`.
- [ ] Unique `<title>` and a description of about 150 characters.
- [ ] Canonical matches the page's own URL, with no `localhost`.
- [ ] `og:title`, `og:description`, `og:url` and `og:image` are all this page's own.
- [ ] Listed in `sitemap.xml`, with no `noindex`.
- [ ] Main content is in the initial HTML, outside any hidden streamed segment.
- [ ] One `h1`, no skipped headings, and `alt` text on images.
- [ ] Structured data parses, and matches what the page shows. Check it with
      Google's Rich Results Test once the site is live.
- [ ] Internal links use `<Link>`, and none go to `#`.

## Site-wide

- [ ] `robots.txt` allows public pages, blocks `/api/`, and names the sitemap.
- [ ] Unknown URLs return a real 404.
- [ ] Every app page has `noindex` and is out of the sitemap.
- [ ] `robots.txt` doesn't block a page marked `noindex`: crawlers have to fetch the
      page to see the tag.
- [ ] `src/lib/site.ts` holds the real name and description.

## Report

Fix what's clearly wrong, and add a test to `e2e/seo.spec.ts` for each fix. List
what needs a human: real copy, legal pages and Search Console. Run `yarn build` with
no override at the end, so the local build matches `.env`.
