import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { componentFiles } from "./heading-sizes";
import { missingPageSection } from "./page-layout";

// The root layout has no container (since the starter's "Typography and
// layout are theme tokens" decision): a page without page-section would run
// edge to edge with no space around it, and no other check would notice.

const features = readdirSync("packages")
  .filter((name) => name.startsWith("feature-"))
  .map((name) => join("packages", name, "src"))
  .filter((directory) => existsSync(directory));

const routes = componentFiles("apps/web/src/routes").filter(
  (file) => basename(file) !== "__root.tsx",
);
const pages = ["apps/web/src", ...features]
  .flatMap((directory) => componentFiles(directory))
  .filter((file) => file.endsWith("-page.tsx"));

it("finds the routes", () => {
  expect(routes).not.toEqual([]);
});

it("lays out every page as page-section > page-container", () => {
  const files = [...new Set([...routes, ...pages])];
  const problems = files.flatMap(
    (file) => missingPageSection(file, readFileSync(file, "utf8")) ?? [],
  );
  expect(problems).toEqual([]);
});

describe("missingPageSection", () => {
  const route = "apps/web/src/routes/invoices.tsx";

  it("names a page with markup and no page-section", () => {
    expect(
      missingPageSection(route, `<div className="space-y-6"><h1>Hi</h1>`),
    ).toBe(`${route}: wrap the page in page-section > page-container`);
  });

  it("accepts a page with page-section", () => {
    const source = `<section className="page-section"><div className="page-container">`;
    expect(missingPageSection(route, source)).toBeNull();
  });

  it("accepts a route that only renders a feature's page", () => {
    expect(
      missingPageSection(route, `return <Page status={status} />;`),
    ).toBeNull();
  });

  it("doesn't count page-section in a comment", () => {
    const jsx = `<main className="flex-1">{/* Each page is page-section. */}<Outlet /></main>`;
    const line = `// Wrap it in page-section.\n<div className="space-y-6" />`;
    const block = `/* page-section */\n<div className="space-y-6" />`;
    for (const source of [jsx, line, block]) {
      expect(missingPageSection(route, source)).toBe(
        `${route}: wrap the page in page-section > page-container`,
      );
    }
  });

  it("keeps a URL in a string while dropping comments", () => {
    const source = `<a href="https://example.com" className="page-section" />`;
    expect(missingPageSection(route, source)).toBeNull();
  });

  it("requires page-section in a *-page.tsx even without className", () => {
    const file = "packages/feature-x/src/x-page.tsx";
    expect(missingPageSection(file, `return <Card>{children}</Card>;`)).toBe(
      `${file}: wrap the page in page-section > page-container`,
    );
  });
});
