import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailSchema, isEmailAllowed, safeCallbackUrl } from "./auth-schema";

describe("isEmailAllowed", () => {
  it("allows everyone when the list is empty or unset", () => {
    assert.equal(isEmailAllowed("ada@example.com", undefined), true);
    assert.equal(isEmailAllowed("ada@example.com", " , "), true);
  });

  it("matches addresses and domains, ignoring case and spaces", () => {
    const allowed = " Ada@Example.com , @team.test ";
    assert.equal(isEmailAllowed("ada@example.com", allowed), true);
    assert.equal(isEmailAllowed("BOB@TEAM.TEST", allowed), true);
    assert.equal(isEmailAllowed("bob@example.com", allowed), false);
  });

  it("doesn't treat a lookalike domain as the allowed one", () => {
    assert.equal(isEmailAllowed("eve@evilteam.test", "@team.test"), false);
  });

  it("refuses a missing address when there is a list", () => {
    assert.equal(isEmailAllowed(null, "@team.test"), false);
  });
});

describe("safeCallbackUrl", () => {
  it("keeps a path on this site", () => {
    assert.equal(
      safeCallbackUrl("/bookings?status=pending"),
      "/bookings?status=pending",
    );
  });

  const unsafe: Record<string, unknown> = {
    "another site": "https://evil.example",
    "a protocol-relative URL": "//evil.example",
    "a backslash trick": "/\\evil.example",
    "a relative path": "bookings",
    "a non-string": ["/bookings"],
  };
  for (const [name, value] of Object.entries(unsafe)) {
    it(`falls back for ${name}`, () => {
      assert.equal(safeCallbackUrl(value), "/bookings");
    });
  }
});

describe("emailSchema", () => {
  it("trims and lowercases", () => {
    assert.equal(emailSchema.parse("  Ada@Example.COM "), "ada@example.com");
  });

  it("requires a domain with a dot", () => {
    assert.equal(emailSchema.safeParse("ada@localhost").success, false);
  });
});
