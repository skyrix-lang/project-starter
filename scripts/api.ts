import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// yarn api:generate  writes packages/api/openapi.json from the BFF's routes,
//                    then the client, types and MSW mocks from it.
// yarn api:check     fails when either is out of date: the contract check
//                    between the BFF and the web app, run by `yarn verify`.

const API = "packages/api";
const check = process.argv[2] === "check";

function run(cwd: string, args: string[], env: Record<string, string> = {}) {
  execFileSync("yarn", args, {
    cwd,
    stdio: check ? "pipe" : "inherit",
    env: { ...process.env, ...env },
  });
}

function sameFiles(a: string, b: string) {
  const files = readdirSync(a).sort();
  if (files.join() !== readdirSync(b).sort().join()) return false;
  return files.every(
    (file) =>
      readFileSync(join(a, file), "utf8") ===
      readFileSync(join(b, file), "utf8"),
  );
}

if (!check) {
  run("apps/bff", ["export-openapi"]);
  run(API, ["generate"]);
} else {
  let problem: string | undefined;
  const scratch = mkdtempSync(join(tmpdir(), "booking-api-"));
  // Next to src/generated, so the generated import of ../fetcher is the same.
  const generated = `src/.check-${process.pid}`;
  try {
    const spec = join(scratch, "openapi.json");
    run("apps/bff", ["export-openapi", spec]);
    if (
      readFileSync(spec, "utf8") !== readFileSync(`${API}/openapi.json`, "utf8")
    ) {
      problem = "packages/api/openapi.json doesn't match the BFF's routes.";
    } else {
      run(API, ["generate"], { ORVAL_OUT: `./${generated}` });
      if (!sameFiles(join(API, generated), `${API}/src/generated`)) {
        problem = "packages/api/src/generated doesn't match openapi.json.";
      }
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
    rmSync(join(API, generated), { recursive: true, force: true });
  }
  if (problem) {
    console.error(
      `${problem} Run \`yarn api:generate\` and commit the result.`,
    );
    process.exit(1);
  }
}
