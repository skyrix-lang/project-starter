import { readdirSync, readFileSync, statSync } from "node:fs";
import { builtinModules } from "node:module";
import { dirname, join, relative, resolve } from "node:path";

// yarn boundaries (part of `yarn verify`): the dependency rules between
// workspaces. Each package may import only the workspaces its layer allows, and
// only packages it declares in its own package.json, so nothing works by
// accident through hoisting. Relative imports stay inside the package.

/** Which workspaces each one may depend on. A pattern ending in * is a prefix. */
const ALLOWED: Record<string, string[]> = {
  "@booking/core": [],
  "@booking/db": ["@booking/core"],
  "@booking/api": [],
  "@booking/ui": [],
  "@booking/theme-default": [],
  "@booking/feature-*": ["@booking/core", "@booking/api", "@booking/ui"],
  "@booking/web": [
    "@booking/core",
    "@booking/api",
    "@booking/ui",
    "@booking/feature-*",
    "@booking/theme-*",
  ],
  "@booking/bff": ["@booking/core", "@booking/db"],
};

const matches = (pattern: string, name: string) =>
  pattern.endsWith("*")
    ? name.startsWith(pattern.slice(0, -1))
    : pattern === name;

const IMPORT =
  /(?:import|export)\s[^"']*?from\s*["']([^"']+)["']|import\s*\(?\s*["']([^"']+)["']/g;
const isTest = (file: string) =>
  /\.test\.tsx?$|test-utils\.tsx?$|test-server\.ts$/.test(file);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

function packageName(specifier: string) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

const problems: string[] = [];
const workspaces = ["apps", "packages"].flatMap((group) =>
  readdirSync(group).map((name) => join(group, name)),
);
const rootManifest = JSON.parse(readFileSync("package.json", "utf8"));
const rootDev = Object.keys(rootManifest.devDependencies ?? {});

for (const workspace of workspaces) {
  const manifest = JSON.parse(
    readFileSync(join(workspace, "package.json"), "utf8"),
  );
  const name: string = manifest.name;
  const rule = Object.entries(ALLOWED).find(([pattern]) =>
    matches(pattern, name),
  );
  if (!rule) {
    problems.push(`${name}: no rule in scripts/check-boundaries.ts`);
    continue;
  }
  const deps = Object.keys(manifest.dependencies ?? {});
  const devDeps = Object.keys(manifest.devDependencies ?? {});

  for (const file of sourceFiles(join(workspace, "src"))) {
    if (file.includes(`${join("src", "generated")}`)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT)) {
      const specifier = (match[1] ?? match[2])!;
      const where = `${file}: "${specifier}"`;
      if (specifier.startsWith(".")) {
        const target = resolve(dirname(file), specifier);
        if (relative(resolve(workspace), target).startsWith("..")) {
          problems.push(
            `${where} reaches outside ${workspace}: import the package instead`,
          );
        }
        continue;
      }
      if (specifier.startsWith("node:") || builtinModules.includes(specifier))
        continue;
      const dependency = packageName(specifier);
      if (dependency.startsWith("@booking/") && dependency !== name) {
        if (!rule[1].some((pattern) => matches(pattern, dependency))) {
          problems.push(`${where}: ${name} may not depend on ${dependency}`);
          continue;
        }
      }
      if (dependency === name) continue;
      const declared = isTest(file) ? [...deps, ...devDeps, ...rootDev] : deps;
      // Types-only and build-time imports may come from devDependencies.
      const typeOnly = /^import\s+type\s/.test(match[0]);
      if (
        !declared.includes(dependency) &&
        !(typeOnly && devDeps.includes(dependency))
      ) {
        problems.push(
          `${where}: add ${dependency} to ${workspace}/package.json (yarn workspace ${name} add ${dependency})`,
        );
      }
    }
  }
}

if (problems.length > 0) {
  console.error(`Dependency rules broken:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Dependency rules hold for ${workspaces.length} workspaces.`);
