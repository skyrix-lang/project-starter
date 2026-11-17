import { execFileSync, spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, matchesGlob, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renameText, titleFromSlug, type Names } from "./rename";

// yarn sync-from-starter [--from <dir>] [--ref <ref>] [--dry-run]
//
// Brings what changed in project-starter since the last sync into a project
// made from it. For each file the starter changed, it merges three versions,
// all with the starter's names replaced by the project's (yarn rename's rules):
// the starter's file at the last sync, the starter's file now, and the
// project's file. The project's own edits stay; the starter's land on top; when
// both changed the same lines, git conflict markers show both.
//
// .starter.json, committed in the project, holds the starter commit of the last
// sync, the project's names, and the paths never to sync. The first time, pass
// the starter commit the project was made from: --base <commit>.
//
// Versions don't need this: Renovate updates them in every project, from the
// policy in the starter's default.json.

export const STARTER_REPO = "git@github.com:skyrix-lang/project-starter.git";
export const CONFIG_FILE = ".starter.json";

/** Never synced: the lockfile is rebuilt by `yarn install`, the Renovate preset
 * and this project's own record belong to one repository each. */
export const ALWAYS_IGNORED = ["yarn.lock", "default.json", CONFIG_FILE];

/** Hold the starter's names on purpose: copied as they are. */
export const VERBATIM = new Set([
  "scripts/rename.ts",
  "scripts/rename.test.ts",
  "scripts/sync-from-starter.ts",
  "scripts/sync-from-starter.test.ts",
]);

export type Config = Names & {
  /** The starter commit this project was last synced with. */
  commit: string;
  /** Globs of paths the project owns: the starter's changes to them are skipped. */
  ignore?: string[];
};

export type Status = "A" | "M" | "D";

/** What to do with one path the starter changed. */
export type Action =
  | { kind: "write"; content: Buffer }
  | { kind: "merge" }
  | { kind: "delete" }
  | { kind: "none"; reason: string }
  | { kind: "skip"; reason: string };

export function isIgnored(path: string, ignore: readonly string[] = []) {
  return [...ALWAYS_IGNORED, ...ignore].some(
    (glob) => path === glob || matchesGlob(path, glob),
  );
}

/** `packages/feature-bookings/src/x.ts` is in the `packages/feature-bookings` workspace. */
export function workspaceOf(path: string): string | undefined {
  const match = /^((?:apps|packages)\/[^/]+)\//.exec(path);
  return match?.[1];
}

const isBinary = (content: Buffer) => content.includes(0);

/** The starter's file as this project would have it. */
export function adapt(path: string, content: Buffer, names: Names): Buffer {
  if (VERBATIM.has(path) || isBinary(content)) return content;
  return Buffer.from(renameText(content.toString("utf8"), names));
}

/**
 * Decides from the three versions, already adapted to the project's names.
 * `base` is the starter's file at the last sync, `theirs` the starter's now,
 * `ours` the project's; undefined when the file doesn't exist there.
 */
export function decide(change: {
  status: Status;
  base?: Buffer;
  theirs?: Buffer;
  ours?: Buffer;
  /** False when the file belongs to a workspace the project removed. */
  workspaceExists: boolean;
}): Action {
  const { status, base, theirs, ours, workspaceExists } = change;
  if (status === "D") {
    if (!ours) return { kind: "none", reason: "already gone" };
    if (base && ours.equals(base)) return { kind: "delete" };
    return {
      kind: "skip",
      reason: "deleted in the starter, changed here: kept",
    };
  }
  if (!theirs) throw new Error(`No starter content for a ${status} change`);
  if (ours?.equals(theirs)) return { kind: "none", reason: "already the same" };
  if (!ours) {
    if (!workspaceExists) {
      return { kind: "skip", reason: "in a workspace this project removed" };
    }
    if (status === "M") {
      return { kind: "skip", reason: "changed in the starter, deleted here" };
    }
    return { kind: "write", content: theirs };
  }
  if (base && ours.equals(base)) return { kind: "write", content: theirs };
  if (isBinary(ours) || isBinary(theirs)) {
    return { kind: "skip", reason: "binary, changed on both sides" };
  }
  return { kind: "merge" };
}

/** `A\0path\0M\0path\0` from `git diff --name-status -z`. */
export function parseNameStatus(output: string): [Status, string][] {
  const fields = output.split("\0").filter(Boolean);
  const changes: [Status, string][] = [];
  for (let i = 0; i + 1 < fields.length; i += 2) {
    const status = fields[i]?.charAt(0);
    const path = fields[i + 1];
    if (path && (status === "A" || status === "M" || status === "D")) {
      changes.push([status, path]);
    }
  }
  return changes;
}

function run(cmd: string, args: string[], cwd?: string): string {
  return execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

type Options = {
  from?: string;
  ref: string;
  base?: string;
  title?: string;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Options {
  const options: Options = { ref: "HEAD", dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () =>
      argv[++i] ??
      fail(`${arg} needs a value. See scripts/sync-from-starter.ts.`);
    if (arg === "--from") options.from = value();
    else if (arg === "--ref") options.ref = value();
    else if (arg === "--base") options.base = value();
    else if (arg === "--title") options.title = value();
    else if (arg === "--dry-run") options.dryRun = true;
    else {
      fail(
        "Usage: yarn sync-from-starter [--from <dir>] [--ref <ref>] [--dry-run]\n" +
          "  first sync: add --base <starter commit the project was made from>\n" +
          "  [--title <display name>]",
      );
    }
  }
  return options;
}

/** A starter checkout: --from, $STARTER_DIR, ../project-starter, or a fresh clone. */
function starterDir(from: string | undefined): {
  dir: string;
  cleanup?: () => void;
} {
  const local = from ?? process.env.STARTER_DIR ?? "../project-starter";
  if (existsSync(join(local, ".git"))) return { dir: resolve(local) };
  if (from) fail(`${from} is not a git checkout of the starter.`);
  const dir = mkdtempSync(join(tmpdir(), "starter-"));
  console.log(`• Cloning ${STARTER_REPO}…`);
  execFileSync(
    "git",
    ["clone", "--quiet", "--no-checkout", STARTER_REPO, dir],
    {
      stdio: "inherit",
    },
  );
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = JSON.parse(readFileSync("package.json", "utf8")) as {
    name: string;
  };
  if (root.name === "booking-platform") {
    fail("This is the starter itself: run it in a project made from it.");
  }
  if (run("git", ["status", "--porcelain"]).trim() && !options.dryRun) {
    fail("Commit or stash your changes first, so the sync is the whole diff.");
  }

  const saved = existsSync(CONFIG_FILE)
    ? (JSON.parse(readFileSync(CONFIG_FILE, "utf8")) as Config)
    : undefined;
  const commit = options.base ?? saved?.commit;
  if (!commit) {
    fail(
      `No ${CONFIG_FILE} yet. The first time, pass the starter commit this\n` +
        "project was made from: yarn sync-from-starter --base <commit>",
    );
  }
  const slug = saved?.slug ?? root.name;
  const config: Config = {
    slug,
    title: options.title ?? saved?.title ?? titleFromSlug(slug),
    commit,
    ignore: saved?.ignore ?? [],
  };

  const starter = starterDir(options.from);
  const tmp = mkdtempSync(join(tmpdir(), "starter-sync-"));
  try {
    const git = (...args: string[]) => run("git", args, starter.dir);
    const target = git(
      "rev-parse",
      "--verify",
      `${options.ref}^{commit}`,
    ).trim();
    const base = git(
      "rev-parse",
      "--verify",
      `${config.commit}^{commit}`,
    ).trim();
    if (target === base) {
      console.log(`Already in sync with the starter at ${target.slice(0, 7)}.`);
      return;
    }
    const show = (rev: string, path: string) =>
      execFileSync("git", ["show", `${rev}:${path}`], {
        cwd: starter.dir,
        maxBuffer: 64 * 1024 * 1024,
      });
    const mode = (rev: string, path: string) =>
      git("ls-tree", rev, "--", path).split(" ")[0];

    const log = git("log", "--oneline", "--no-merges", `${base}..${target}`);
    console.log(
      `Starter ${base.slice(0, 7)} → ${target.slice(0, 7)}:\n${log.replace(/^/gm, "  ")}`,
    );

    const changes = parseNameStatus(
      git("diff", "--name-status", "--no-renames", "-z", base, target),
    );
    const done: Record<"updated" | "added" | "merged" | "deleted", string[]> = {
      updated: [],
      added: [],
      merged: [],
      deleted: [],
    };
    const skipped: string[] = [];
    const conflicts: string[] = [];

    for (const [status, path] of changes) {
      if (isIgnored(path, config.ignore)) continue;
      const theirs =
        status === "D" ? undefined : adapt(path, show(target, path), config);
      const baseContent =
        status === "A" ? undefined : adapt(path, show(base, path), config);
      const ours = existsSync(path) ? readFileSync(path) : undefined;
      const workspace = workspaceOf(path);
      const action = decide({
        status,
        base: baseContent,
        theirs,
        ours,
        workspaceExists: !workspace || existsSync(workspace),
      });

      if (action.kind === "none") continue;
      if (action.kind === "skip") {
        skipped.push(`${path}: ${action.reason}`);
        continue;
      }
      if (action.kind === "delete") {
        if (!options.dryRun) rmSync(path);
        done.deleted.push(path);
        continue;
      }
      if (action.kind === "write") {
        if (!options.dryRun) {
          mkdirSync(dirname(path), { recursive: true });
          writeFileSync(path, action.content);
          if (mode(target, path) === "100755") chmodSync(path, 0o755);
        }
        (ours ? done.updated : done.added).push(path);
        continue;
      }
      // Both sides changed: three-way merge, as git does for a branch.
      const files = ["ours", "base", "theirs"].map((name) => join(tmp, name));
      writeFileSync(files[0]!, ours ?? "");
      writeFileSync(files[1]!, baseContent ?? "");
      writeFileSync(files[2]!, theirs ?? "");
      const merged = spawnSync(
        "git",
        [
          "merge-file",
          "-p",
          "-L",
          "project",
          "-L",
          `starter ${base.slice(0, 7)}`,
          "-L",
          `starter ${target.slice(0, 7)}`,
          ...files,
        ],
        { maxBuffer: 64 * 1024 * 1024 },
      );
      if (merged.status === null || merged.status < 0) {
        skipped.push(`${path}: git merge-file failed`);
        continue;
      }
      if (!options.dryRun) writeFileSync(path, merged.stdout);
      (merged.status > 0 ? conflicts : done.merged).push(path);
    }

    const list = (title: string, paths: string[]) => {
      if (paths.length) console.log(`\n${title}:\n  ${paths.join("\n  ")}`);
    };
    list("Updated (unchanged here, so replaced)", done.updated);
    list("Added", done.added);
    list("Merged with this project's changes", done.merged);
    list("Deleted", done.deleted);
    list("Skipped", skipped);
    list("CONFLICTS: resolve the <<<<<<< markers", conflicts);

    if (options.dryRun) {
      console.log("\nDry run: nothing written.");
      return;
    }
    writeFileSync(
      CONFIG_FILE,
      `${JSON.stringify({ ...config, commit: target }, null, 2)}\n`,
    );
    const touched = [...Object.values(done).flat(), ...conflicts];
    if (touched.some((path) => /(^|\/)package\.json$/.test(path))) {
      console.log("\n• package.json changed: updating yarn.lock…");
      const install = spawnSync("yarn", ["install"], { stdio: "inherit" });
      if (install.status !== 0) {
        console.log(
          "  yarn install failed: run it again once conflicts are resolved.",
        );
      }
    }
    console.log(`
Next: review the diff (git diff), resolve any conflicts, then
  yarn format && yarn verify
and commit with .starter.json, which now records ${target.slice(0, 7)}.
To undo everything: git checkout -- . && git clean -fd`);
    if (conflicts.length) process.exitCode = 1;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    starter.cleanup?.();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
