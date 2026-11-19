# Customizing for a customer

What to change to make the starter a customer's site: brand, languages, icons, pages and features.

- **Branding:** copy `packages/theme-default` into a new theme package, change
  the CSS variables, and import it in `apps/web/src/styles.css`. Components use
  only these tokens. `scripts/theme-contrast.test.ts` (in `yarn verify`) fails
  when a text colour drops below 4.5:1 on its background, or an input border,
  the focus ring or a button below 3:1, in every `theme-*` package and in each
  mode it defines (light, and dark if it has one).
- **Dark mode:** the theme's `.dark` block. The header's button switches it,
  following the system until used; the choice is kept in this browser and
  applied before the first paint (`apps/web/public/theme.js`). A theme
  without a `.dark` block stays light: remove the button from the header too.
- **Languages:** `LANGUAGES` in `packages/core/src/site.ts`, default first.
  Visitors get the first one their browser asks for and can switch in the
  header (shown when there are two or more). Texts are JSON files per
  language: `apps/web/src/locales/` and each feature's `src/locales/`.
  [translate.i18next.com](https://translate.i18next.com) translates a whole
  file; have a native speaker review it. A one-language site keeps one entry
  and one file per namespace; set `lang` in `apps/web/index.html` to it.
- **Link previews and icons:** replace `apps/web/public/og-image.png`
  (1200 × 630), `favicon.ico` (48, 32 and 16 px) and `apple-touch-icon.png`
  (180 px, square corners) with the customer's own, and the name, URL and
  logo in `index.html`'s JSON-LD.
- **Pages:** replace a package's page in `apps/web/src/overrides.ts`. A route
  that doesn't exist is a type error. Add the customer's own routes in
  `apps/web/src/routes/`.
- **Features:** add a `packages/feature-*` package. It may depend on `core`,
  `api` and `ui` only (`scripts/check-boundaries.ts`).
