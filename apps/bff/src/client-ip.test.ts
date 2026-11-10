import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("uses the entry the nearest proxy added, not what the client sent", () => {
    const headers = new Headers({
      "x-forwarded-for": "1.1.1.1, 203.0.113.7",
    });
    expect(clientIp(headers)).toBe("203.0.113.7");
  });

  it("is undefined without the header", () => {
    expect(clientIp(new Headers())).toBeUndefined();
  });
});
