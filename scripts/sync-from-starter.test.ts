import { describe, expect, it } from "vitest";
import {
  adapt,
  decide,
  isIgnored,
  parseNameStatus,
  workspaceOf,
} from "./sync-from-starter";

const names = { slug: "acme", title: "Acme" };
const b = (text: string) => Buffer.from(text);

describe("adapt", () => {
  it("gives the starter's file the project's names", () => {
    expect(
      adapt("scripts/x.ts", b('from "@booking/core"'), names).toString(),
    ).toBe('from "@acme/core"');
  });

  it("copies the rename and sync scripts as they are", () => {
    const content = b('const STARTER_NAME = "booking-platform";');
    expect(adapt("scripts/rename.ts", content, names)).toEqual(content);
    expect(adapt("scripts/sync-from-starter.ts", content, names)).toEqual(
      content,
    );
    expect(adapt("docs/starter-sync.md", content, names)).toEqual(content);
  });

  it("leaves binary files alone", () => {
    const content = Buffer.from([0x89, 0x00, 0x40, 0x62, 0x6f]);
    expect(adapt("apps/web/public/logo.png", content, names)).toEqual(content);
  });
});

describe("decide", () => {
  const base = b("base");
  const theirs = b("theirs");
  const ours = b("ours");

  it("takes the starter's file when the project never changed it", () => {
    expect(
      decide({ status: "M", base, theirs, ours: base, workspaceExists: true }),
    ).toEqual({ kind: "write", content: theirs });
  });

  it("merges when both changed it", () => {
    expect(
      decide({ status: "M", base, theirs, ours, workspaceExists: true }),
    ).toEqual({ kind: "merge" });
  });

  it("does nothing when the project already has the starter's version", () => {
    expect(
      decide({ status: "M", base, theirs, ours: theirs, workspaceExists: true })
        .kind,
    ).toBe("none");
  });

  it("keeps the project's deletion of a file the starter changed", () => {
    expect(
      decide({ status: "M", base, theirs, workspaceExists: true }).kind,
    ).toBe("skip");
  });

  it("adds a new file, unless its workspace was removed", () => {
    expect(decide({ status: "A", theirs, workspaceExists: true })).toEqual({
      kind: "write",
      content: theirs,
    });
    expect(decide({ status: "A", theirs, workspaceExists: false }).kind).toBe(
      "skip",
    );
  });

  it("always takes the starter's version of the sync tooling", () => {
    for (const ours of [b("ours"), undefined]) {
      expect(
        decide({
          status: "M",
          base,
          theirs,
          ours,
          workspaceExists: true,
          owned: true,
        }),
      ).toEqual({ kind: "write", content: theirs });
    }
  });

  it("merges a new file that the project already wrote its own way", () => {
    expect(
      decide({ status: "A", theirs, ours, workspaceExists: true }),
    ).toEqual({ kind: "merge" });
  });

  it("deletes only what the project never changed", () => {
    expect(
      decide({ status: "D", base, ours: base, workspaceExists: true }).kind,
    ).toBe("delete");
    expect(
      decide({ status: "D", base, ours, workspaceExists: true }).kind,
    ).toBe("skip");
    expect(decide({ status: "D", base, workspaceExists: true }).kind).toBe(
      "none",
    );
  });

  it("never merges binary files", () => {
    expect(
      decide({
        status: "M",
        base,
        theirs: Buffer.from([0, 1]),
        ours,
        workspaceExists: true,
      }).kind,
    ).toBe("skip");
  });
});

describe("isIgnored", () => {
  it("always ignores the lockfile, the Renovate preset and the sync record", () => {
    expect(isIgnored("yarn.lock")).toBe(true);
    expect(isIgnored("default.json")).toBe(true);
    expect(isIgnored(".starter.json")).toBe(true);
    expect(isIgnored("scripts/setup.ts")).toBe(false);
  });

  it("ignores the project's own globs", () => {
    expect(isIgnored("docs/decisions.md", ["docs/**"])).toBe(true);
    expect(isIgnored("README.md", ["README.md"])).toBe(true);
    expect(isIgnored("docker/Dockerfile", ["docs/**"])).toBe(false);
  });
});

describe("workspaceOf", () => {
  it("finds the workspace a path belongs to", () => {
    expect(workspaceOf("packages/feature-bookings/src/list.tsx")).toBe(
      "packages/feature-bookings",
    );
    expect(workspaceOf("apps/bff/src/app.ts")).toBe("apps/bff");
    expect(workspaceOf("scripts/setup.ts")).toBeUndefined();
  });
});

describe("parseNameStatus", () => {
  it("reads git diff --name-status -z", () => {
    expect(parseNameStatus("M\0a.ts\0A\0b c.ts\0D\0d.ts\0")).toEqual([
      ["M", "a.ts"],
      ["A", "b c.ts"],
      ["D", "d.ts"],
    ]);
  });
});
