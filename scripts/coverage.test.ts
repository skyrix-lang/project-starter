import { describe, expect, it } from "vitest";
import { belowMinimums, parseMinimums } from "./coverage";
import { counts, sourcePath } from "./coverage-options";

describe("sourcePath", () => {
  it("gives the same path from a source map, Vitest or the repository", () => {
    for (const path of [
      "../../../../packages/ui/src/components/badge.tsx",
      "/home/ci/work/repo/packages/ui/src/components/badge.tsx",
      "packages/ui/src/components/badge.tsx",
    ])
      expect(sourcePath(path)).toBe("packages/ui/src/components/badge.tsx");
  });

  it("resolves the BFF's own source from its bundle", () => {
    expect(
      sourcePath("../src/app.ts", {
        distFile: "file:///repo/apps/bff/dist/server.js",
      }),
    ).toBe("apps/bff/src/app.ts");
  });

  it("makes a lazy route's component the route's own file", () => {
    expect(
      sourcePath("/repo/apps/web/src/routes/bookings.tsxtsr-split=component"),
    ).toBe("apps/web/src/routes/bookings.tsx");
  });

  it("leaves other paths as they are", () => {
    expect(sourcePath("node_modules/react/index.js")).toBe(
      "node_modules/react/index.js",
    );
  });
});

describe("counts", () => {
  it("counts the apps' and packages' source", () => {
    expect(counts("../../src/routes/index.tsx")).toBe(false);
    expect(counts("../../../apps/bff/src/bookings.ts")).toBe(true);
    expect(counts("packages/feature-bookings/src/booking-card.tsx")).toBe(true);
  });

  it("leaves out tests, generated code and dependencies", () => {
    expect(counts("apps/bff/src/bookings.test.ts")).toBe(false);
    expect(counts("apps/web/src/routeTree.gen.ts")).toBe(false);
    expect(counts("packages/api/src/generated/hooks.ts")).toBe(false);
    expect(counts("node_modules/hono/dist/index.js")).toBe(false);
    expect(counts("packages/feature-bookings/src/test-utils.tsx")).toBe(false);
    expect(counts("apps/web/src/locales/en.json")).toBe(false);
  });
});

describe("minimums", () => {
  const minimums = { statements: 60, branches: 50, functions: 55, lines: 60 };

  it("reads coverage-minimums.json", () => {
    expect(parseMinimums(minimums)).toEqual(minimums);
  });

  it("refuses a missing or impossible minimum", () => {
    expect(() => parseMinimums({ ...minimums, lines: 120 })).toThrow(/lines/);
    expect(() => parseMinimums({ statements: 1 })).toThrow(/branches/);
  });

  it("lists each metric below its minimum", () => {
    const pct = (n: number) => ({ pct: n });
    expect(
      belowMinimums(
        {
          statements: pct(61),
          branches: pct(49.5),
          functions: pct(55),
          lines: pct(59),
        },
        minimums,
      ),
    ).toEqual([
      "branches: 49.5% is below the minimum of 50%",
      "lines: 59% is below the minimum of 60%",
    ]);
  });
});
