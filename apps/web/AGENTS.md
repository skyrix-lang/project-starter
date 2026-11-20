# apps/web: the customer app

Thin by design: routes (`src/routes`), the theme import (`src/styles.css`), page
overrides (`src/overrides.ts`) and layout. Feature screens come from
`packages/feature-*`; a customer's own screens go here.

- Routes are TanStack Router file routes; `src/routeTree.gen.ts` is generated
  (commit it, never edit it).
- App routes call `requireUser` in `beforeLoad` and `usePageMeta` with `noindex`.
- Never import `@booking/db` or anything server-side.
- The root layout (`src/routes/__root.tsx`) has no container: each page is
  `page-section` > `page-container` (AGENTS.md, "Typography and layout").
