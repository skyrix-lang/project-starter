import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

// Several agents can work at once, each in its own git worktree. These give each
// checkout its own ports and databases, so their dev servers and test runs don't
// collide. Postgres and Mailpit are shared: one container each, many databases.

/** A number from 0 to 899, stable for this checkout's directory. */
export function checkoutSlot(directory = process.cwd()): number {
  return createHash("sha256").update(directory).digest().readUInt16BE(0) % 900;
}

/** True in a linked worktree (`git worktree add`), false in the main checkout. */
export function isWorktree(): boolean {
  const git = (flag: string) =>
    execFileSync("git", ["rev-parse", "--path-format=absolute", flag], {
      encoding: "utf8",
    }).trim();
  try {
    return git("--git-dir") !== git("--git-common-dir");
  } catch {
    return false;
  }
}

/** Dev server port: 3000 in the main checkout, 4000–4899 in a worktree. */
export function devPort(): number {
  return isWorktree() ? 4000 + checkoutSlot() : 3000;
}

/** Playwright's production server: 3100–3999, different for every checkout. */
export function e2ePort(): number {
  return 3100 + checkoutSlot();
}

/** Database names. Test databases end in `_e2e`, which the reset requires. */
export function databaseNames() {
  const suffix = isWorktree() ? `_wt${checkoutSlot()}` : "";
  return {
    dev: `booking${suffix}`,
    e2e: `booking_${checkoutSlot()}_e2e`,
  };
}
