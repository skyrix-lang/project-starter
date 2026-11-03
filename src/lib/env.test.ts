import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseEnv } from "./env";

const development = {
  DATABASE_URL: "postgres://booking:booking@localhost:5432/booking",
  AUTH_SECRET: "change-me",
};

const production = {
  ...development,
  NODE_ENV: "production",
  AUTH_SECRET: "x".repeat(32),
  AUTH_URL: "https://example.com",
};

describe("parseEnv", () => {
  it("accepts the development defaults from .env.example", () => {
    assert.equal(parseEnv(development).DATABASE_URL, development.DATABASE_URL);
  });

  it("lists every missing variable at once", () => {
    assert.throws(() => parseEnv({}), /DATABASE_URL[\s\S]*AUTH_SECRET/);
  });

  it("rejects a database URL that isn't Postgres", () => {
    assert.throws(
      () => parseEnv({ ...development, DATABASE_URL: "mysql://localhost/db" }),
      /DATABASE_URL/,
    );
  });

  it("treats empty optional values as unset", () => {
    const env = parseEnv({ ...development, AUTH_ALLOWED_EMAILS: "" });
    assert.equal(env.AUTH_ALLOWED_EMAILS, undefined);
  });

  it("requires provider variables in pairs", () => {
    assert.throws(
      () => parseEnv({ ...development, AUTH_GOOGLE_ID: "client-id" }),
      /AUTH_GOOGLE_ID/,
    );
  });

  it("accepts a complete production setup", () => {
    assert.doesNotThrow(() => parseEnv(production));
  });

  it("requires a real secret in production", () => {
    assert.throws(
      () => parseEnv({ ...production, AUTH_SECRET: "change-me" }),
      /AUTH_SECRET/,
    );
  });

  it("requires AUTH_URL in production", () => {
    assert.throws(
      () => parseEnv({ ...production, AUTH_URL: undefined }),
      /AUTH_URL/,
    );
  });
});
