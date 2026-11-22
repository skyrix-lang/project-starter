import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CoverageReportOptions } from "monocart-coverage-reports";

// Shared by the e2e fixture that records the browser's coverage
// (e2e/support.ts) and the script that merges everything (scripts/coverage.ts).

/** Where `yarn test:coverage` writes. */
export const COVERAGE_DIR = "coverage";
/** The merged report: coverage/report/index.html. */
export const REPORT_DIR = `${COVERAGE_DIR}/report`;
/** The e2e tests' browser data (one entry per test) and their raw report.
 * Its own folder: generating a report empties it. */
export const E2E_DIR = `${COVERAGE_DIR}/e2e`;
/** Vitest's (vitest.config.ts). */
export const UNIT_DIR = `${COVERAGE_DIR}/unit`;
/** The BFF's, written when it stops (NODE_V8_COVERAGE, playwright.config.ts). */
export const BFF_DIR = `${COVERAGE_DIR}/bff`;

/** The app's own source, as a path from the repository root.
 * - A path relative to the built file (the BFF's own source in its source
 *   map, such as `../src/app.ts`) is resolved from that file first.
 * - What follows the extension is dropped: a lazy route's component comes
 *   as `routes/x.tsx?tsr-split=component` (with the `?` already gone), and
 *   is the same file as `routes/x.tsx`. */
export function sourcePath(path: string, info?: { distFile?: string }) {
  const dist = info?.distFile;
  const absolute =
    path.startsWith("../") && dist?.startsWith("file:")
      ? resolve(dirname(fileURLToPath(dist)), path)
      : path;
  const source = /(?:^|\/)((?:apps|packages)\/[^/]+\/src\/.*)$/.exec(
    absolute,
  )?.[1];
  return source ? source.replace(/(\.tsx?)(?:\?.*|tsr-split=.*)$/, "$1") : path;
}

/** What counts: the TypeScript source of the apps and packages, not tests,
 * test helpers, generated code, messages files or dependencies. */
export function counts(path: string) {
  const source = sourcePath(path);
  return (
    /^(?:apps|packages)\/[^/]+\/src\/.*\.tsx?$/.test(source) &&
    !source.endsWith(".d.ts") &&
    !/\.test\.tsx?$/.test(source) &&
    !/(?:^|\/)test-utils\.tsx?$/.test(source) &&
    !source.endsWith(".gen.ts") &&
    !source.startsWith("packages/api/")
  );
}

/** How every part reads its data: source files by repository path, so
 * the same file merges whichever test ran it. */
export const COVERAGE_OPTIONS: CoverageReportOptions = {
  logging: "error",
  sourcePath,
  sourceFilter: (path) => !path.includes("node_modules") && counts(path),
  // Files no test loads count too, as not covered at all.
  all: {
    dir: ["apps", "packages"],
    filter: (path) => !path.includes("node_modules") && counts(path),
    // Compiled like the build does, so their statements, branches and
    // functions count, not only their lines.
    transformer: async (entry: {
      url: string;
      source: string;
      sourceMap?: unknown;
    }) => {
      // Loaded here only: the e2e fixture imports this file in every worker.
      const { transformWithOxc } = await import("vite");
      const { code, map } = await transformWithOxc(
        entry.source,
        fileURLToPath(entry.url),
        { sourcemap: true, jsx: { runtime: "automatic" } },
      );
      entry.source = code;
      entry.sourceMap = map;
    },
  },
};

/** The e2e tests' browser and BFF data: the app's bundles and the server's
 * bundle, nothing else the browser or Node ran. */
export const E2E_COVERAGE_OPTIONS: CoverageReportOptions = {
  ...COVERAGE_OPTIONS,
  name: "e2e",
  outputDir: E2E_DIR,
  entryFilter: (entry) =>
    entry.url.includes("/assets/") || entry.url.includes("/apps/bff/dist/"),
};

/** Vitest's (vitest.config.ts, through vitest-monocart-coverage). */
export const UNIT_COVERAGE_OPTIONS: CoverageReportOptions = {
  ...COVERAGE_OPTIONS,
  name: "Unit tests",
  outputDir: UNIT_DIR,
  reports: [["raw", { outputDir: "raw" }], "console-summary"],
};
