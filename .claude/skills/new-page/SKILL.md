---
name: new-page
description: Create a new Next.js page or route in this project, with the right rendering, metadata, SEO files and Playwright test. Use whenever adding a page, screen, route, landing page or any new URL.
---

# Add a page

## 1. Classify it

Work out which type the page is from the request. Ask only if it's unclear.

- **Public:** should appear in Google, such as a landing, pricing or article page.
- **App:** a working screen, such as a dashboard, or anything behind a login.

## 2. Build it

Create `src/app/<route>/page.tsx` as a Server Component. Keep route-only components
beside the page, and shared ones in `src/components`. `params` and `searchParams`
are promises: await them. Validate `searchParams` with Zod `safeParse`.

|                 | Public page                 | App page                   |
| --------------- | --------------------------- | -------------------------- |
| Rendering       | Static or `revalidate`      | Dynamic is fine            |
| `loading.tsx`   | No                          | Yes, if it reads data      |
| Canonical       | Yes                         | No                         |
| Robots          | Indexable                   | `robots: { index: false }` |
| Sitemap         | Add to `src/app/sitemap.ts` | Leave out                  |
| Open Graph      | Yes                         | No                         |
| Structured data | If a type fits              | No                         |

A public page needs metadata like this. A page's `openGraph` replaces the layout's,
so spread `sharedOpenGraph`:

```tsx
import type { Metadata } from "next";
import { sharedOpenGraph } from "@/lib/site";

const title = "Pricing";
const description = "One clear sentence of about 150 characters.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/pricing" },
  openGraph: { ...sharedOpenGraph, title, description, url: "/pricing" },
};
```

An app page needs only this:

```tsx
export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false },
};
```

For dynamic routes, use `generateMetadata` and call `notFound()` when the record
doesn't exist. Public dynamic routes also list their URLs in `sitemap.ts`, and use
`generateStaticParams` when the set of pages is known.

## 3. Check the structure

- One `h1`, no skipped heading levels, and meaningful `alt` text.
- Add it to `navLinks` in `src/components/layout/Header.tsx` if it needs a nav link.
- Keep any `"use client"` to the smallest interactive component.
- Copy existing colours and spacing from `src/app/globals.css` tokens.

## 4. Test and verify

Add tests to `e2e/` covering the page's content and main interaction. For a public
page, add to `e2e/seo.spec.ts`: canonical, description, sitemap entry and no
`noindex`. For an app page, check it has `noindex` and isn't in the sitemap.

Run `yarn format`, then `yarn check`, `yarn lint` and `yarn test`. Confirm in the
`yarn build` route table that a public page is `○` (static), not `ƒ` (dynamic).
