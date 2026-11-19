# packages/theme-default

The default brand: CSS variables only (`src/theme.css`). A customer theme is a
copy of this package with other values. Keep text at WCAG 2.2 AA contrast
(4.5:1), and input borders, the focus ring and buttons at 3:1, in every mode:
`scripts/theme-contrast.test.ts` checks each pair in every `theme-*` package.
