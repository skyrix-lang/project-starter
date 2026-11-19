import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { negotiateEncoding } from "./compression";

// Serving the built SPA, from a small stand-in for apps/web/dist, with and
// without Google Analytics configured. The e2e tests check the real build.

const dist = mkdtempSync(join(tmpdir(), "static-test-"));
mkdirSync(join(dist, "assets"));
const page = `<html><head><link rel="canonical" href="%PUBLIC_URL%/" /><meta name="ga-measurement-id" content="%GA_MEASUREMENT_ID%" /></head><body>${"<p>Content</p>".repeat(100)}</body></html>`;
writeFileSync(join(dist, "index.html"), page);
const script = "console.log('app');".repeat(100);
writeFileSync(join(dist, "assets", "app-1234.js"), script);
writeFileSync(join(dist, "assets", "app-1234.js.gz"), gzipSync(script));
// Different content, to tell which file was sent.
writeFileSync(join(dist, "assets", "app-1234.js.br"), "brotli");
afterAll(() => rmSync(dist, { recursive: true }));

vi.spyOn(process.stdout, "write").mockReturnValue(true);

async function createApp(settings: Record<string, string> = {}) {
  vi.unstubAllEnvs();
  vi.stubEnv("PUBLIC_URL", "https://bookings.example.com");
  vi.stubEnv("DATABASE_URL", "postgres://unused@localhost:1/unused");
  vi.stubEnv("SESSION_SECRET", "test-secret");
  vi.stubEnv("OIDC_ISSUER", "https://id.example.com/realms/booking");
  vi.stubEnv("OIDC_CLIENT_ID", "booking-web");
  vi.stubEnv("OIDC_CLIENT_SECRET", "secret");
  vi.stubEnv("STATIC_DIR", dist);
  vi.stubEnv("GA_MEASUREMENT_ID", "");
  for (const [name, value] of Object.entries(settings)) vi.stubEnv(name, value);
  // env() is read once per module: load the app afresh with these settings.
  vi.resetModules();
  return (await import("./app")).createApp();
}

beforeEach(() => vi.resetModules());

describe("Google Analytics", () => {
  it("is off by default: no id in the page, no Google in the CSP", async () => {
    const app = await createApp();
    const response = await app.request("/");

    expect(await response.text()).toContain(
      '<meta name="ga-measurement-id" content="" />',
    );
    expect(response.headers.get("content-security-policy")).not.toMatch(
      /google/,
    );
  });

  it("with an id, hands it to the app and allows Google's origins", async () => {
    const app = await createApp({ GA_MEASUREMENT_ID: "G-AB12CD34EF" });
    const response = await app.request("/");

    expect(await response.text()).toContain(
      '<meta name="ga-measurement-id" content="G-AB12CD34EF" />',
    );
    const csp = response.headers.get("content-security-policy")!;
    const directive = (name: string) =>
      csp
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name} `));
    expect(directive("script-src")).toBe(
      "script-src 'self' https://*.googletagmanager.com",
    );
    expect(directive("connect-src")).toContain(
      "https://*.google-analytics.com",
    );
    expect(directive("connect-src")).toContain(
      "https://*.analytics.google.com",
    );
    expect(directive("img-src")).toContain("https://*.google-analytics.com");
    expect(csp).not.toContain("unsafe-inline");
  });
});

describe("compression", () => {
  it("sends the build's brotli file to a browser that accepts it", async () => {
    const app = await createApp();
    const response = await app.request("/assets/app-1234.js", {
      headers: { "Accept-Encoding": "gzip, deflate, br, zstd" },
    });

    expect(response.headers.get("content-encoding")).toBe("br");
    expect(response.headers.get("vary")).toBe("Accept-Encoding");
    expect(response.headers.get("content-type")).toMatch(/javascript/);
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toBe("brotli");
  });

  it("falls back to gzip, then to the file itself", async () => {
    const app = await createApp();
    const gzipped = await app.request("/assets/app-1234.js", {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(gzipped.headers.get("content-encoding")).toBe("gzip");
    expect(
      gunzipSync(Buffer.from(await gzipped.arrayBuffer())).toString(),
    ).toBe(script);

    const plain = await app.request("/assets/app-1234.js");
    expect(plain.headers.get("content-encoding")).toBeNull();
    // Still varies: a cache must not serve this copy to a brotli browser either.
    expect(plain.headers.get("vary")).toBe("Accept-Encoding");
    expect(await plain.text()).toBe(script);
  });

  it("compresses the page, filled in, for each encoding", async () => {
    const app = await createApp();
    const br = await app.request("/bookings", {
      headers: { "Accept-Encoding": "gzip, br" },
    });
    expect(br.headers.get("content-encoding")).toBe("br");
    expect(br.headers.get("vary")).toBe("Accept-Encoding");
    expect(br.headers.get("content-type")).toBe("text/html; charset=UTF-8");
    const html = brotliDecompressSync(
      Buffer.from(await br.arrayBuffer()),
    ).toString();
    expect(html).toContain(
      '<link rel="canonical" href="https://bookings.example.com/" />',
    );

    const gzip = await app.request("/bookings", {
      headers: { "Accept-Encoding": "gzip" },
    });
    expect(gzip.headers.get("content-encoding")).toBe("gzip");
    expect(gunzipSync(Buffer.from(await gzip.arrayBuffer())).toString()).toBe(
      html,
    );

    const plain = await app.request("/bookings");
    expect(plain.headers.get("content-encoding")).toBeNull();
    expect(await plain.text()).toBe(html);
  });
});

describe("negotiateEncoding", () => {
  it.each([
    [undefined, undefined],
    ["", undefined],
    ["identity", undefined],
    ["gzip, deflate, br, zstd", "br"],
    ["gzip", "gzip"],
    ["GZIP", "gzip"],
    ["br;q=0.5, gzip;q=0.8", "gzip"],
    ["br;q=0, gzip", "gzip"],
    ["*", "br"],
    ["*;q=0.1, gzip;q=0", "br"],
    ["br;q=0, gzip;q=0", undefined],
  ])("%s gives %s", (header, expected) => {
    expect(negotiateEncoding(header)).toBe(expected);
  });
});
