// PostToolUse: formats each file an agent edits with oxfmt, as `yarn format`
// would, so the diff stays clean and format:check doesn't fail later. It never
// blocks: oxfmt skips files it doesn't handle or that .oxfmtrc.json ignores.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path;
const oxfmt = "node_modules/.bin/oxfmt";

if (file && existsSync(file) && existsSync(oxfmt)) {
  try {
    execFileSync(oxfmt, [file], { stdio: "ignore", timeout: 15_000 });
  } catch {
    // Unsupported or unparsable file: `yarn format:check` reports real problems.
  }
}
