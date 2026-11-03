// PreToolUse: refuses edits that the project rules forbid, with the reason, so
// the agent changes course instead of finding out in review.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

const input = JSON.parse(readFileSync(0, "utf8"));
const file = input.tool_input?.file_path;
if (!file) process.exit(0);
const path = relative(input.cwd ?? process.cwd(), file);

function isCommitted(path) {
  try {
    execFileSync("git", ["cat-file", "-e", `HEAD:${path}`], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function refuse(reason) {
  process.stderr.write(reason);
  process.exit(2);
}

// A committed migration may already be applied somewhere. A new one can still be
// reviewed and edited before it's committed.
if (/^drizzle\/.+\.(sql|json)$/.test(path) && isCommitted(path)) {
  refuse(
    `${path} is a committed migration, and may already be applied. Never edit it: ` +
      "change src/lib/db/schema.ts and run `yarn db:generate --name=<what_changed>` " +
      "for a new migration instead.",
  );
}

if (/^\.env(\.[\w.]+)?$/.test(path) && path !== ".env.example") {
  refuse(
    `${path} holds local secrets. Change .env.example (and src/lib/env.ts) instead, ` +
      "and tell the user which value to set.",
  );
}

if (path === "yarn.lock") {
  refuse(
    "Don't edit yarn.lock: change dependencies with `yarn add` or `yarn remove`.",
  );
}
