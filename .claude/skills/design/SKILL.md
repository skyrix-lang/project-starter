---
name: design
description: Design a website's look with the person, from a brief and reference examples to the theme (colours, fonts, type, spacing), docs/design.md, the header and footer, and page layouts. Use when starting a new site or brand, redesigning, changing the look or theme, choosing fonts or colours, or designing a page before it's built.
---

# Design a site

The result of a design is not mockups: it's the theme's tokens
(`packages/theme-*/src/theme.css`, `fonts.css`), `docs/design.md`, and pages
built from the utilities in AGENTS.md, "Typography and layout". Mockups are
throwaway steps to agree on those. Work in this order and wait for the person
at each **Agree** step: going back is cheap there and expensive later.

## 1. Brief

Ask, in one message, only what you can't tell from the request and the repo:

- Who the site is for, what a visitor should do (book, call, buy, read), and
  the pages it needs.
- The tone, in three or four words (calm, premium, playful, clinical…).
- What exists already: logo, colours, fonts, photos, a current site.
- Two to five references (URLs or screenshots), and for each **what** they
  like or dislike in it: the type, the spacing, the colours, a section.

Read references for principles (contrast, density, rhythm, type pairing),
never to copy a site: no one's logo, illustrations, photos or layout as is.
Fonts and images must be licensed for the site.

## 2. Directions

Propose two or three distinct directions. Each is one self-contained HTML
file (or an Artifact, where your tool has them) showing, with the real texts
where you have them:

- a hero (display title, lead paragraph, primary button), a section with
  three cards (section and card titles), a form field, a muted band;
- light and dark side by side if the brand has a dark mode;
- exactly the token names of `packages/theme-default/src/theme.css`, in
  `:root` and `.dark` as there, so the chosen one moves to the theme
  unchanged. Its own small CSS stands in for the utilities (`.text-display`,
  `.text-h2`, `.page-container`…), reading those variables, so the mockup
  maps one to one to the real page.

Name each by its idea ("Warm editorial", "Clinical clean"), with one line on
why it fits the brief. Keep the files out of the repository.

**Agree** on one direction, then on adjustments to it, still in the mockup.

## 3. Theme

- New brand: copy `packages/theme-default` to `packages/theme-<slug>`, rename
  it in its `package.json`, add it to the app with
  `yarn workspace @booking/web add @booking/theme-<slug>@workspace:^`, and
  import it in `apps/web/src/styles.css` (`docs/customizing.md`,
  "Branding"). An existing brand: edit its theme package.
- Write the chosen values. Fonts are self-hosted in `fonts.css`
  (`packages/theme-default/AGENTS.md`, "Fonts"), never from a CDN.
- `yarn verify` checks contrast (`scripts/theme-contrast.test.ts`): adjust a
  colour that fails rather than the pair list.
- Logo, favicon and link preview image: `docs/customizing.md`.

## 4. Record it in `docs/design.md`

Rewrite it for this brand, keeping its headings: the brief, the direction and
what was taken from each reference, the token values and why, how type and
sections are used, imagery and icons, do's and don'ts, and the pages with
their sections. Agents read it before building any page, so write rules, not
history. `yarn sync-from-starter` adds the starter's when a project has none,
and never changes the project's after.

## 5. Global layout

Header, navigation (desktop and mobile), footer, and the section patterns
the pages will share (hero, card grid, band, call to action). A pattern used
on two pages or more becomes a component built on `page-section` >
`page-container`: in `apps/web/src/components/`, or in `packages/ui` when a
feature package needs it (features can't import the app). Add it to
`docs/design.md`.

## 6. Pages

For each page, first list its sections top to bottom, with each section's
pattern, heading and content, and the page's one `h1`. **Agree** on the list,
then build it with the `new-page` skill and show it running (`run-app`):
desktop and phone width, light and dark. Adjust in the running page; a change
to a token goes to the theme, never to one page.

## 7. Check

- No raw colours, sizes or widths: tokens and utilities only. `yarn verify`
  catches raw heading sizes and pages without `page-section`, not the rest.
- One `text-display` at most per page, on public pages only.
- `yarn verify` and `yarn test` pass (axe runs on every page tested).
- `docs/design.md` matches what was built.
