import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("uses the entry the nearest proxy added, not what the client sent", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.1.1.1, 203.0.113.7",
    });
    assert.equal(clientIp(headers), "203.0.113.7");
  });

  it("is undefined without the header", () => {
    assert.equal(clientIp(new Headers()), undefined);
  });
});
