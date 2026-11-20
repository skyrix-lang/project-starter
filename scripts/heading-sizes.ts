// Headings take their size from the theme's text-display, text-h1, text-h2 and
// text-h3 utilities (packages/ui/src/styles.css), never a raw Tailwind size:
// heading-sizes.test.ts runs this on apps/web/src and packages/feature-*/src.
// A regex, not a parser: it reads each <h1>, <h2> or <h3> opening tag up to
// its first ">" and looks for text-2xl or larger in it, with any variant.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HEADING = /<h([1-3])(?=[\s>])[^>]*>/g;
const RAW_SIZE = /(?<![\w-])text-([2-9]xl)\b/;

/** The `line: <hN> uses text-Nxl` problems in one file's source. */
export function rawHeadingSizes(source: string): string[] {
  return [...source.matchAll(HEADING)].flatMap((match) => {
    const size = RAW_SIZE.exec(match[0])?.[1];
    if (!size) return [];
    const line = source.slice(0, match.index).split("\n").length;
    return [`${line}: <h${match[1]}> uses text-${size}`];
  });
}

/** The .tsx files under a directory, recursively. */
export function componentFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return componentFiles(path);
    return entry.endsWith(".tsx") ? [path] : [];
  });
}
