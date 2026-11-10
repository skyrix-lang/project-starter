import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const development = {
  PUBLIC_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://booking:booking@localhost:5432/booking",
  SESSION_SECRET: "change-me",
  OIDC_ISSUER: "http://localhost:8180/realms/booking",
  OIDC_CLIENT_ID: "booking-web",
  OIDC_CLIENT_SECRET: "booking-web-secret",
};

const production = {
  ...development,
  NODE_ENV: "production",
  PUBLIC_URL: "https://bookings.example.com",
  SESSION_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  it("accepts the development defaults from .env.example", () => {
    expect(parseEnv(development).DATABASE_URL).toBe(development.DATABASE_URL);
  });

  it("lists every missing variable at once", () => {
    expect(() => parseEnv({})).toThrow(
      /PUBLIC_URL[\s\S]*DATABASE_URL[\s\S]*SESSION_SECRET[\s\S]*OIDC_ISSUER/,
    );
  });

  it("rejects a database URL that isn't Postgres", () => {
    expect(() =>
      parseEnv({ ...development, DATABASE_URL: "mysql://localhost/db" }),
    ).toThrow(/DATABASE_URL/);
  });

  it("drops a trailing slash from the public URL", () => {
    const env = parseEnv({
      ...development,
      PUBLIC_URL: "http://localhost:3000/",
    });
    expect(env.PUBLIC_URL).toBe("http://localhost:3000");
  });

  it("accepts a complete production setup", () => {
    expect(() => parseEnv(production)).not.toThrow();
  });

  it("requires a real secret in production", () => {
    expect(() =>
      parseEnv({ ...production, SESSION_SECRET: "change-me" }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("requires https in production, except on localhost", () => {
    expect(() =>
      parseEnv({ ...production, PUBLIC_URL: "http://bookings.example.com" }),
    ).toThrow(/PUBLIC_URL/);
    expect(() =>
      parseEnv({ ...production, PUBLIC_URL: "http://localhost:3100" }),
    ).not.toThrow();
  });
});
