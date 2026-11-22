// yarn test:coverage: how much of the app's source the tests run, all of
// them together, and whether that is still above the minimums in
// coverage-minimums.json. The nightly runs it (docs/development.md,
// "Coverage").
//
//   1. Vitest, with coverage (vitest-monocart-coverage): coverage/unit/raw.
//   2. Playwright with E2E_COVERAGE=1 (Docker, about a minute): each test in
//      Chromium records the browser's code (e2e/support.ts), and the BFF
//      writes its own on exit (NODE_V8_COVERAGE, playwright.config.ts).
//   3. Both merged, by source file, into coverage/report/index.html, then
//      checked.
//
// With arguments, only those e2e tests run, and nothing is checked: it shows
// what they cover (`yarn test:coverage e2e/bookings.scenario.spec.ts`).
// The minimums only go up: raise them when coverage does, never lower them
// to make a run pass.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { CoverageReport } from "monocart-coverage-reports";
import {
  BFF_DIR,
  COVERAGE_DIR,
  COVERAGE_OPTIONS,
  E2E_COVERAGE_OPTIONS,
  E2E_DIR,
  REPORT_DIR,
  UNIT_DIR,
  counts,
} from "./coverage-options";

const METRICS = ["statements", "branches", "functions", "lines"] as const;
type Metric = (typeof METRICS)[number];

/** coverage-minimums.json: a percentage per metric. */
export function parseMinimums(json: unknown): Record<Metric, number> {
  const value = (json ?? {}) as Record<string, unknown>;
  for (const m of METRICS) {
    const n = value[m];
    if (typeof n !== "number" || n < 0 || n > 100)
      throw new Error(
        `coverage-minimums.json: "${m}" must be a percentage, from 0 to 100.`,
      );
  }
  return value as Record<Metric, number>;
}

/** The metrics below their minimum, as lines to print. */
export function belowMinimums(
  summary: Record<Metric, { pct: number | string }>,
  minimums: Record<Metric, number>,
) {
  return METRICS.filter((m) => Number(summary[m].pct) < minimums[m]).map(
    (m) => `${m}: ${summary[m].pct}% is below the minimum of ${minimums[m]}%`,
  );
}

function run(command: string, args: string[], env: Record<string, string>) {
  const { status } = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  return status ?? 1;
}

async function main() {
  const minimums = parseMinimums(
    JSON.parse(readFileSync("coverage-minimums.json", "utf8")),
  );
  // Test files or folders named: those alone. Options (`--project desktop`)
  // still go to Playwright, but don't make it a partial run.
  const args = process.argv.slice(2);
  const only = args.filter((arg) => /^e2e\b|\.spec\.tsx?$/.test(arg));
  rmSync(COVERAGE_DIR, { recursive: true, force: true });

  // Vitest's raw V8 data, through vitest-monocart-coverage
  // (vitest.config.ts): coverage/unit/raw. Not when looking at some e2e
  // tests alone.
  const unit = only.length
    ? 0
    : run("yarn", ["vitest", "run", "--coverage"], {});
  const e2e = run("yarn", ["playwright", "test", ...args], {
    E2E_COVERAGE: "1",
  });

  // The e2e tests': the browser's (coverage/e2e/.cache, one entry per test)
  // and the BFF's, kept raw too: coverage/e2e/raw.
  const e2eReport = new CoverageReport({
    ...E2E_COVERAGE_OPTIONS,
    reports: [["raw", { outputDir: "raw" }]],
  });
  // The BFF writes its coverage when it stops by itself. Killed instead
  // (it didn't stop within playwright.config.ts's gracefulShutdown), it
  // writes none, and the whole BFF would look untested.
  const bffWrote =
    existsSync(BFF_DIR) &&
    readdirSync(BFF_DIR).some((file) =>
      readFileSync(`${BFF_DIR}/${file}`, "utf8").includes(
        "/apps/bff/dist/server.js",
      ),
    );
  if (bffWrote) await e2eReport.addFromDir(BFF_DIR);
  await e2eReport.generate();

  // All of it, merged by source file: the same code counts once, whichever
  // test ran it.
  const report = new CoverageReport({
    ...COVERAGE_OPTIONS,
    name: "Coverage",
    outputDir: REPORT_DIR,
    inputDir: [`${UNIT_DIR}/raw`, `${E2E_DIR}/raw`].filter((dir) =>
      existsSync(dir),
    ),
    reports: ["v8", "console-summary", "json-summary"],
    // Merged raw data still holds every file the bundles came from.
    outputFilter: (file) => counts(file.sourcePath),
  });
  const results = await report.generate();

  if (unit !== 0 || e2e !== 0) {
    console.error("Tests failed: coverage is incomplete, not checked.");
    process.exit(1);
  }
  if (!results) {
    console.error("No coverage was recorded.");
    process.exit(1);
  }
  if (!bffWrote) {
    console.error(
      "The BFF wrote no coverage: it was killed instead of stopping by itself. Not checked.",
    );
    process.exit(1);
  }
  if (only.length) {
    console.log(
      `What ${only.join(" ")} cover${only.length > 1 ? "" : "s"}, alone: ${REPORT_DIR}/index.html. Minimums not checked.`,
    );
    return;
  }
  const below = belowMinimums(results.summary, minimums);
  if (below.length > 0) {
    console.error(
      ["Coverage dropped below coverage-minimums.json:", ...below].join("\n  "),
    );
    process.exit(1);
  }
  console.log(`Coverage report: ${REPORT_DIR}/index.html`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
