# packages/theme-default

The default brand: CSS variables only (`src/theme.css`). A customer theme is a
copy of this package with other values. Keep text at WCAG 2.2 AA contrast
(4.5:1), and input borders, the focus ring and buttons at 3:1, in every mode
(light in `:root`, dark in `.dark`; leave `.dark` out for a light-only brand):
`scripts/theme-contrast.test.ts` checks each pair in every `theme-*` package.

## Tokens

`packages/ui/src/styles.css` turns them into Tailwind utilities. Typography
and layout tokens live in `:root` only; colours also in `.dark`.

A brand usually changes:

- **Colours:** `--background`, `--foreground`, `--card`, `--card-foreground`,
  `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`; the brand
  colour `--primary`, `--primary-hover`, `--primary-foreground`,
  `--primary-soft`, `--primary-soft-foreground`; `--secondary`,
  `--secondary-foreground`; and, less often, the statuses `--success-soft*`,
  `--warning-soft*`, `--destructive`, `--destructive-soft*`.
- **Fonts:** `--font-sans` (body text) and `--font-heading` (h1 to h3 and the
  `text-display`, `text-h1`, `text-h2`, `text-h3` utilities; the body font by
  default).
- **Radius:** `--radius`, the corners (`rounded-sm`, `rounded-md`,
  `rounded-lg`).
- **Headings:** `--heading-weight` (700) and `--heading-tracking` (-0.025em).

Rarely touched, since every page's layout depends on them:

- `--content-width` (80rem): max width of a page's content, `page-container`.
- `--prose-width` (65ch): max width of long text, `prose-width`.
- `--section-space` (4rem): space above and below a page section,
  `page-section`.

The typography and layout utilities fall back to these default values, so a
theme that leaves one out keeps the default.

## Fonts

A brand font is self-hosted, never loaded from Google Fonts or another CDN
(visitors' privacy, the CSP, and deployments without internet). Put the
`.woff2` files in the theme package (`src/fonts/`), declare them in a
`src/fonts.css` next to `theme.css`, and import it first:

```css
/* src/fonts.css */
@font-face {
  font-family: "Brand Sans";
  src: url("./fonts/brand-sans-variable.woff2") format("woff2");
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}
```

```css
/* src/theme.css */
@import "./fonts.css";

:root {
  --font-sans: "Brand Sans", ui-sans-serif, system-ui, sans-serif;
  --font-heading: "Brand Display", var(--font-sans);
}
```

Vite bundles the files with the app (a file under 4 KB would be inlined as a
`data:` URL, which the CSP's `font-src 'self'` refuses; real fonts are
larger). Keep a system fallback after the font,
prefer one variable font to several weights, and check the font's licence
allows self-hosting. theme-default ships no font: it uses the system's.
