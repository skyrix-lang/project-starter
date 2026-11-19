import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contrast,
  failingPairs,
  SHAPE_PAIRS,
  TEXT_PAIRS,
  themes,
} from "./theme-contrast";

// Every theme package keeps its colours at WCAG 2.2 AA in every mode it
// defines (light, and dark when it has one). The e2e axe checks only see the
// screens and states the tests reach, with the theme the app imports; this
// checks every token pair, in every theme package, without a browser.

const themePackages = readdirSync("packages").filter((name) =>
  name.startsWith("theme-"),
);

it("finds the theme packages", () => {
  expect(themePackages).not.toEqual([]);
});

describe.each(themePackages)("packages/%s", (name) => {
  const css = readFileSync(join("packages", name, "src", "theme.css"), "utf8");
  const modes = themes(css);

  it("has a light mode", () => {
    expect(modes[0]?.name).toBe("light");
  });

  describe.each(modes)("in $name mode", ({ tokens }) => {
    // Colours are read as hex (#rgb or #rrggbb) only: write theme colours so.
    it("defines every colour a pair uses, in hex", () => {
      const used = [...TEXT_PAIRS, ...SHAPE_PAIRS].flatMap(([color, on]) => [
        color,
        ...on,
      ]);
      expect(used.filter((token) => !tokens[token])).toEqual([]);
    });

    it("keeps text readable (4.5:1)", () => {
      expect(failingPairs(tokens, TEXT_PAIRS, 4.5)).toEqual([]);
    });

    it("keeps input borders, focus rings and buttons visible (3:1)", () => {
      expect(failingPairs(tokens, SHAPE_PAIRS, 3)).toEqual([]);
    });
  });
});

describe("contrast", () => {
  it("matches WCAG's formula", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
    // A pair just below AA, as WebAIM's checker gives it.
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("accepts short hex colours", () => {
    expect(contrast("#fff", "#000")).toBeCloseTo(21);
  });
});

describe("themes", () => {
  const css = `
    :root { --a: #ffffff; --b: #000000; --radius: 0.5rem; }
    @media (prefers-color-scheme: dark) {
      :root { --a: #111111; }
    }
    .dark { --b: #eeeeee; }
  `;

  it("reads the light mode, then each dark mode on top of it", () => {
    expect(themes(css)).toEqual([
      { name: "light", tokens: { a: "#ffffff", b: "#000000" } },
      { name: "dark", tokens: { a: "#111111", b: "#000000" } },
      { name: ".dark", tokens: { a: "#ffffff", b: "#eeeeee" } },
    ]);
  });

  it("reads a theme that starts with an @import", () => {
    const imported = `@import "./fonts.css";\n${css}`;
    expect(themes(imported).map((mode) => mode.name)).toEqual([
      "light",
      "dark",
      ".dark",
    ]);
  });

  it("names the pairs below the minimum", () => {
    const tokens = { text: "#777777", page: "#ffffff", other: "#000000" };
    expect(failingPairs(tokens, [["text", ["page", "other"]]], 4.5)).toEqual([
      "text on page (4.48:1)",
    ]);
  });
});
