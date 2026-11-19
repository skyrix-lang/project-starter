# packages/ui

The UI kit: shadcn/ui-style components on Base UI, styled only with theme
tokens (`src/styles.css` maps them to Tailwind). No app code, no data
fetching, no routing. Every component must be accessible by keyboard and
screen reader. No texts of its own either: a label a component needs (the
toasts' close button) is a prop, so the app passes it translated.
