import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// yarn rename <name> ["Display Name"]: the first step of a project started from
// this starter. It replaces the starter's own name everywhere it's an
// identifier: the package scope (@booking/*), the root package and image name,
// the local containers, database, Keycloak realm and client, and the site name.
//
// It does not touch the bookings feature (packages/feature-bookings, the
// /api/bookings routes, the bookings table): that's the reference
// implementation, kept to copy from and removed when the project has its own.

const STARTER_NAME = "booking-platform";
const GENERATED = "packages/api/src/generated/";

export type Names = {
  /** Package scope, image and container prefix: `acme` gives `@acme/core`. */
  slug: string;
  /** What people see: the site's name and title. */
  title: string;
};

/** Lowercase letters, digits and dashes: valid as an npm scope and a Docker name. */
export function isValidSlug(slug: string): boolean {
  return /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug);
}

/** `acme-portal` becomes `Acme Portal`. */
export function titleFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Letters, digits, spaces and dashes. The name lands in HTML, JSON, TypeScript
 * strings and generated identifiers, so anything that needs escaping in one of
 * them is refused rather than escaped four ways.
 */
export function isValidTitle(title: string): boolean {
  return /^[\p{L}\p{N}]+([ -][\p{L}\p{N}]+)*$/u.test(title);
}

/** One file's content with the starter's names replaced. */
export function renameText(content: string, { slug, title }: Names): string {
  // Postgres names can't hold a dash without quoting.
  const db = slug.replaceAll("-", "_");
  const rules: [pattern: RegExp, replacement: string][] = [
    [/@booking\//, `@${slug}/`],
    [/booking-platform/, slug],
    // Containers, the volume, the migration image, the OIDC client and its
    // secret, and a temporary folder. Not `booking-card` or `booking-schema`.
    [/\bbooking(?=-(?:db|keycloak|migrate|web|api-))/, slug],
    // The Keycloak realm.
    [/(?<=realms\/)booking\b/, slug],
    [/(?<="realm": ")booking(?=")/, slug],
    // The Postgres user, password and database.
    [/(?<=postgres:\/\/)booking:booking(?=@)/, `${db}:${db}`],
    [/(?<=:5432\/)booking\b/, db],
    [/(?<=POSTGRES_(?:USER|PASSWORD|DB)(?:=|: ))booking\b/, db],
    [/(?<=-U(?: |", "))booking\b/, db],
    [/(?<=`)booking(?=_?\$\{|`)/, db],
    [/BookingHub/, title],
  ];
  // One pass over the original text, so a new name that contains one of the
  // starter's (`hotel-booking-web`) isn't renamed a second time.
  const all = new RegExp(
    rules.map(([pattern]) => `(${pattern.source})`).join("|"),
    "g",
  );
  return content.replace(all, (match, ...groups: unknown[]) => {
    const rule = rules[groups.findIndex((group) => group !== undefined)];
    return rule ? rule[1] : match;
  });
}

function git(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    console.error(
      "This needs a git repository: it renames the files git tracks, and the\n" +
        "diff is how you review the result. Run `git init && git add -A` first.",
    );
    process.exit(1);
  }
}

function main() {
  const [slug, title = slug && titleFromSlug(slug)] = process.argv.slice(2);
  if (!slug || !title || !isValidSlug(slug) || !isValidTitle(title)) {
    console.error(
      'Usage: yarn rename <name> ["Display Name"]\n' +
        "  <name>: lowercase letters, digits and dashes, such as acme-portal\n" +
        "  Display Name: letters, digits, spaces and dashes",
    );
    process.exit(1);
  }
  const root = JSON.parse(readFileSync("package.json", "utf8")) as {
    name: string;
  };
  if (root.name !== STARTER_NAME) {
    console.error(
      `This project is already named ${root.name}: nothing to rename.`,
    );
    process.exit(1);
  }

  const files = git("ls-files", "-z").split("\0").filter(Boolean);
  if (git("status", "--porcelain").trim()) {
    console.error(
      "Commit or stash your changes first, so the rename is the whole diff.",
    );
    process.exit(1);
  }

  // yarn.lock is rewritten by the install below. This script and its test hold
  // the starter's names on purpose.
  const skipped = new Set([
    "yarn.lock",
    "scripts/rename.ts",
    "scripts/rename.test.ts",
  ]);
  let changed = 0;
  for (const file of files) {
    if (skipped.has(file) || file.startsWith(GENERATED)) continue;
    const before = readFileSync(file, "utf8");
    if (before.includes("\0")) continue; // binary
    const after = renameText(before, { slug, title });
    if (after === before) continue;
    writeFileSync(file, after);
    changed += 1;
  }
  console.log(`• Renamed to ${slug} ("${title}") in ${changed} files.`);

  console.log("• Updating yarn.lock…");
  execFileSync("yarn", ["install"], { stdio: "inherit" });
  // The generated client builds identifiers from the API's title, so it's
  // generated again rather than edited.
  execFileSync("yarn", ["api:generate"], { stdio: "inherit" });
  // A longer or shorter name moves line breaks.
  execFileSync("yarn", ["format"], { stdio: "inherit" });

  console.log(`
Done. Next:
  docker stop booking-db booking-keycloak
                             only if the starter's own containers are running
                             on this machine: they hold the same ports
  rm -f .env && yarn setup   containers and database under the new name
  yarn verify && yarn test
Review the diff before committing. Still the starter's, and yours to write: the
description in package.json, and the site's description, logo and metadata in
apps/web/index.html and packages/core/src/site.ts.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
