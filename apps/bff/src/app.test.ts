import { beforeAll, describe, expect, it, vi } from "vitest";
import type { createApp as CreateApp } from "./app";

// The parts of the server that need no database: security headers, the CSRF
// check, session checks on the API and the SEO files. The e2e tests cover the rest.

let app: ReturnType<typeof CreateApp>;

beforeAll(async () => {
  vi.stubEnv("PUBLIC_URL", "https://bookings.example.com");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost:1/unused");
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("OIDC_ISSUER", "https://id.example.com/realms/booking");
  vi.stubEnv("OIDC_CLIENT_ID", "booking-web");
  vi.stubEnv("OIDC_CLIENT_SECRET", "secret");
  const { createApp } = await import("./app");
  app = createApp();
});

describe("the API", () => {
  for (const [method, path] of [
    ["GET", "/api/bookings"],
    ["POST", "/api/bookings"],
    ["PATCH", "/api/bookings/00000000-0000-4000-8000-000000000000"],
  ] as const) {
    it(`refuses ${method} ${path} without a session`, async () => {
      const response = await app.request(path, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "GET" ? undefined : "{}",
      });
      expect(response.status).toBe(401);
    });
  }

  it("serves its OpenAPI document", async () => {
    const { openApiDocument } = await import("./routes/api");
    expect(Object.keys(openApiDocument().paths ?? {})).toEqual(
      expect.arrayContaining([
        "/api/bookings",
        "/api/bookings/{id}",
        "/api/me",
      ]),
    );
  });
});

describe("security", () => {
  it("sends a strict content security policy", async () => {
    const response = await app.request("/robots.txt");
    const csp = response.headers.get("content-security-policy");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("form-action 'self' https://id.example.com");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("strict-transport-security")).toContain(
      "max-age=",
    );
  });

  it("refuses a sign-out form posted from another site", async () => {
    const response = await app.request("/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/x-www-form-urlencoded",
      },
    });
    expect(response.status).toBe(403);
  });
});

describe("SEO files", () => {
  it("builds robots.txt and the sitemap from PUBLIC_URL", async () => {
    const robots = await (await app.request("/robots.txt")).text();
    expect(robots).toContain("Disallow: /api/");
    expect(robots).toContain(
      "Sitemap: https://bookings.example.com/sitemap.xml",
    );

    const sitemap = await (await app.request("/sitemap.xml")).text();
    expect(sitemap).toContain("<loc>https://bookings.example.com</loc>");
    expect(sitemap).not.toContain("/bookings<");
  });
});
