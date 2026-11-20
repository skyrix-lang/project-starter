// Each page lays itself out as page-section > page-container: the root layout
// adds no container (AGENTS.md, "Typography and layout"). page-layout.test.ts
// runs this on the app's routes and on every *-page.tsx in the app and the
// features. A route that only renders a feature's page (no className of its
// own) passes: the feature's page carries the layout.

import { basename } from "node:path";

/** Whether a page file is missing page-section; null when it's fine. */
export function missingPageSection(file: string, source: string) {
  if (/(?<![\w-])page-section(?![\w-])/.test(source)) return null;
  const isPage = basename(file).endsWith("-page.tsx");
  const hasMarkup = /\bclassName\s*=/.test(source);
  return isPage || hasMarkup
    ? `${file}: wrap the page in page-section > page-container`
    : null;
}
