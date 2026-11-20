# Design

How this site looks and why: read it before building or changing a page. The
`design` skill (`.claude/skills/design/SKILL.md`) writes it with the person;
keep it in step with the theme and the pages. Rules, not history.

This is the starter's neutral default brand (`packages/theme-default`). A
project rewrites this file for its own brand with the `design` skill,
keeping the headings; `yarn sync-from-starter` adds it when missing and never
changes it after. While it still describes the default brand, run the skill
before designing pages.

## Brief

- **For:** people who book and manage appointments; the screens are used
  often, for short tasks.
- **Visitors should:** sign in and see or add their bookings.
- **Tone:** clear, calm, trustworthy. Nothing decorative that slows a task.

## Direction

Neutral and functional: slate greys, one blue for action, system fonts,
generous white space on public pages and dense, scannable app screens. Meant
to be replaced, so it takes no strong position.

## Tokens

All in `packages/theme-default/src/theme.css`; what each one does is in
`packages/theme-default/AGENTS.md`.

| Role     | Value                                                                      | Why                                                  |
| -------- | -------------------------------------------------------------------------- | ---------------------------------------------------- |
| Brand    | `--primary` blue `#2563eb` (dark `#60a5fa`)                                | one colour for every action and link                 |
| Surfaces | `--background` slate `#f8fafc`, `--card` white (dark `#0f172a`, `#1e293b`) | cards stand out by colour, border and a light shadow |
| Fonts    | system UI for body and headings                                            | fast, no font files, native feel                     |
| Headings | weight 700, tracking -0.025em                                              | firm titles at a tight measure                       |
| Radius   | `0.5rem`                                                                   | soft but not playful                                 |
| Layout   | content 80rem, text 65ch, sections 4rem                                    | wide app grids, readable text                        |

## Type

- `text-display`: the home hero only.
- `text-h1`: a public page's title. App screens and short pages (sign-in,
  errors) use `text-h2` for their `h1`.
- `text-h2`: section titles. `text-h3`: card and form titles.
- `text-lead`: the paragraph under a hero or page title, in `prose-width`.
- Body text is the default size; secondary text is `text-sm
  text-muted-foreground`.

## Sections and components

- **Hero:** centred `text-display`, `text-lead`, one primary button
  (`apps/web/src/routes/index.tsx`).
- **Card grid:** three columns from `md`, cards with an icon in a
  `bg-primary-soft` square, a `text-h3` title and a short text.
- **App screen:** title and actions in one row (stacked on phones), then the
  content (`packages/feature-bookings/src/bookings-page.tsx`).
- Sections in a row: `pt-0` on the next one.
- Buttons: one primary call to action per section or form, the rest
  `secondary` or `ghost`. Actions repeated on every item of a list (a card's
  confirm button) may be primary at `size="sm"`.

## Imagery and icons

- Icons: Lucide, `aria-hidden` next to a text (an icon-only button has an
  `aria-label`). Sizes: `h-4 w-4` in a button with text, `h-5 w-5` in an
  icon-only button, `h-6 w-6` in a card, `h-12 w-12` for an empty state.
- No photos or illustrations in the default brand.

## Do and don't

- Do use the tokens and utilities for every colour, size and width.
- Do keep one primary call to action per section or form.
- Don't use a raw colour, a raw heading size or a fixed width.
- Don't add a second accent colour: use the soft variants (`primary-soft`,
  `success-soft`…) for emphasis.

## Pages

| Page        | Kind   | Sections                                                       |
| ----------- | ------ | -------------------------------------------------------------- |
| `/`         | public | hero; card grid (scheduling, availability, confirmation)       |
| `/sign-in`  | app    | one narrow card: title, text, sign-in button                   |
| `/bookings` | app    | app screen: title, filters, new booking; grid of booking cards |
