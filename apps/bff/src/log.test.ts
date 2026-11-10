import { describe, expect, it } from "vitest";
import type { LogLevel } from "./env";
import { createLogger, withLogContext } from "./log";

function capture(level: LogLevel, json: boolean) {
  const lines: { line: string; level: LogLevel }[] = [];
  const logger = createLogger({
    level,
    json,
    write: (line, level) => lines.push({ line, level }),
  });
  return { logger, lines };
}

describe("JSON lines (production)", () => {
  it("writes one object per line with the time, level, message and fields", () => {
    const { logger, lines } = capture("info", true);
    logger.info("Request", { status: 200, path: "/api/me" });

    expect(lines).toHaveLength(1);
    expect(lines[0]!.line).not.toContain("\n");
    const entry = JSON.parse(lines[0]!.line);
    expect(entry).toMatchObject({
      level: "info",
      message: "Request",
      status: 200,
      path: "/api/me",
    });
    expect(Number.isNaN(Date.parse(entry.time))).toBe(false);
  });

  it("keeps an error's message, stack and cause", () => {
    const { logger, lines } = capture("info", true);
    const error = new Error("query failed", { cause: new Error("ECONNRESET") });
    logger.error("Unhandled error", { error });

    const entry = JSON.parse(lines[0]!.line);
    expect(entry.error.message).toBe("query failed");
    expect(entry.error.stack).toContain("log.test.ts");
    expect(entry.error.cause.message).toBe("ECONNRESET");
  });

  it("drops what libraries attach to errors: query parameters and token responses", () => {
    const { logger, lines } = capture("info", true);
    // The shapes of drizzle-orm's DrizzleQueryError and oauth4webapi's errors.
    const query = Object.assign(
      new Error(
        'Failed query: insert into "user_sessions"\nparams: ID-TOKEN,hash',
      ),
      { params: ["ID-TOKEN", "hash"], cause: new Error("connection reset") },
    );
    const oidc = Object.assign(new Error("unexpected JWT nonce"), {
      code: "OAUTH_JWT_CLAIM_COMPARISON_FAILED",
      cause: {
        body: { access_token: "ACCESS-TOKEN" },
        claims: { email: "ada@example.test" },
      },
    });
    logger.error("Sign-in callback failed", { error: query });
    logger.error("Sign-in callback failed", { error: oidc });

    const all = lines.map(({ line }) => line).join("\n");
    expect(all).not.toMatch(/ID-TOKEN|ACCESS-TOKEN|ada@example\.test/);
    const [first, second] = lines.map(({ line }) => JSON.parse(line));
    expect(first.error.message).toBe(
      'Failed query: insert into "user_sessions"',
    );
    expect(first.error.cause.message).toBe("connection reset");
    expect(second.error).toMatchObject({
      message: "unexpected JWT nonce",
      code: "OAUTH_JWT_CLAIM_COMPARISON_FAILED",
    });
    expect(second.error).not.toHaveProperty("cause");
  });

  it("still writes the line when a field can't be serialized", () => {
    const { logger, lines } = capture("info", true);
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    logger.info("Odd", { circular, big: 10n });

    expect(JSON.parse(lines[0]!.line)).toMatchObject({
      message: "Odd",
      circular: "[unserializable]",
      big: "10",
    });
  });

  it("doesn't let a field replace the level or the message", () => {
    const { logger, lines } = capture("info", true);
    logger.warn("Real", { level: "info", message: "Fake" });

    expect(JSON.parse(lines[0]!.line)).toMatchObject({
      level: "warn",
      message: "Real",
    });
  });
});

describe("levels", () => {
  it("drops lines below the configured level", () => {
    const { logger, lines } = capture("warn", true);
    logger.debug("no");
    logger.info("no");
    logger.warn("yes");
    logger.error("yes");

    expect(lines.map(({ level }) => level)).toEqual(["warn", "error"]);
  });

  it("logs nothing when silent", () => {
    const { logger, lines } = capture("silent", true);
    logger.error("no");

    expect(lines).toEqual([]);
  });
});

describe("context", () => {
  it("adds the context's fields to every line logged inside it, and only there", async () => {
    const { logger, lines } = capture("info", true);
    await withLogContext({ requestId: "abc" }, async () => {
      await Promise.resolve();
      logger.info("inside");
    });
    logger.info("outside");

    expect(JSON.parse(lines[0]!.line).requestId).toBe("abc");
    expect(JSON.parse(lines[1]!.line)).not.toHaveProperty("requestId");
  });
});

describe("text lines (development)", () => {
  it("is readable, with the error's stack underneath", () => {
    const { logger, lines } = capture("info", false);
    logger.error("Sign-in callback failed", {
      attempt: 2,
      error: new Error("bad state"),
    });

    const [first, ...stack] = lines[0]!.line.split("\n");
    expect(first).toBe(
      'ERROR Sign-in callback failed attempt=2 error="bad state"',
    );
    expect(stack.join("\n")).toContain("Error: bad state");
  });

  it("shows the cause's stack too, without the query's parameters", () => {
    const { logger, lines } = capture("info", false);
    logger.error("Unhandled error", {
      error: new Error("Failed query: select 1\nparams: SECRET", {
        cause: new Error("connection reset"),
      }),
    });

    expect(lines[0]!.line).toContain("Caused by: Error: connection reset");
    expect(lines[0]!.line).not.toContain("SECRET");
  });
});
