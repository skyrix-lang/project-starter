import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { componentFiles, rawHeadingSizes } from "./heading-sizes";

// Pages stay consistent when headings use the theme's sizes. Replace a raw
// size on a heading with the utility nearest to it: text-display (hero,
// public pages only), text-h1, text-h2 or text-h3 (AGENTS.md, "Typography and
// layout").

const directories = [
  "apps/web/src",
  ...readdirSync("packages")
    .filter((name) => name.startsWith("feature-"))
    .map((name) => join("packages", name, "src")),
].filter((directory) => existsSync(directory));

it("finds the app's and features' components", () => {
  expect(directories).toContain("apps/web/src");
});

describe.each(directories)("%s", (directory) => {
  it("sizes headings with text-display, text-h1, text-h2 or text-h3", () => {
    const problems = componentFiles(directory).flatMap((file) =>
      rawHeadingSizes(readFileSync(file, "utf8")).map(
        (problem) => `${file}:${problem}`,
      ),
    );
    expect(problems).toEqual([]);
  });
});

describe("rawHeadingSizes", () => {
  it("names a raw size of text-2xl or larger on h1, h2 or h3", () => {
    const source = [
      `<h1 className="text-4xl font-bold">Title</h1>`,
      `<h2 className="text-2xl">Section</h2>`,
      `<h3 className="text-9xl">Card</h3>`,
    ].join("\n");
    expect(rawHeadingSizes(source)).toEqual([
      "1: <h1> uses text-4xl",
      "2: <h2> uses text-2xl",
      "3: <h3> uses text-9xl",
    ]);
  });

  it("sees sizes behind a variant and in a tag over several lines", () => {
    const source = `<h1\n  id="title"\n  className="text-h1 md:text-3xl"\n>`;
    expect(rawHeadingSizes(source)).toEqual(["1: <h1> uses text-3xl"]);
  });

  it("accepts the theme's utilities and small sizes", () => {
    const source = [
      `<h1 className="text-display">Hero</h1>`,
      `<h1 className="text-h1">Title</h1>`,
      `<h2 className="text-h2 sm:col-span-2">Section</h2>`,
      `<h3 className="text-xl font-semibold">Card</h3>`,
      `<h2 className="text-lg text-primary">Label</h2>`,
    ].join("\n");
    expect(rawHeadingSizes(source)).toEqual([]);
  });

  it("ignores other elements and deeper headings", () => {
    const source = [
      `<p className="text-4xl">Big number</p>`,
      `<h4 className="text-2xl">Small heading</h4>`,
      `<header className="text-2xl">Not a heading</header>`,
      `<span className="text-3xl"><h2>Inside</h2></span>`,
    ].join("\n");
    expect(rawHeadingSizes(source)).toEqual([]);
  });
});
