// Each page lays itself out as page-section > page-container: the root layout
// adds no container (AGENTS.md, "Typography and layout"). page-layout.test.ts
// runs this on the app's routes and on every *-page.tsx in the app and the
// features. A route that only renders a feature's page (no className of its
// own) passes: the feature's page carries the layout. Comments don't count: a
// layout route that says "each page is page-section" must not pass for it.

import { basename } from "node:path";

/** The source without its comments: block, JSX and line comments. */
function withoutComments(source: string) {
  return (
    source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      // Not after ":", so a URL in a string ("https://…") stays.
      .replace(/(?<!:)\/\/.*$/gm, "")
  );
}

/** Whether a page file is missing page-section; null when it's fine. */
export function missingPageSection(file: string, source: string) {
  const code = withoutComments(source);
  if (/(?<![\w-])page-section(?![\w-])/.test(code)) return null;
  const isPage = basename(file).endsWith("-page.tsx");
  const hasMarkup = /\bclassName\s*=/.test(code);
  return isPage || hasMarkup
    ? `${file}: wrap the page in page-section > page-container`
    : null;
}
