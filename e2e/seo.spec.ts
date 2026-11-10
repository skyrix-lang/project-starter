import { expect, test } from "./support";

// PUBLIC_URL is the server's own address in the tests (playwright.config.ts).

test.describe("home page", () => {
  test("has a canonical URL and social metadata in the HTML", async ({
    request,
    baseURL,
  }) => {
    // What a crawler or link preview reads before any JavaScript runs.
    const html = await (await request.get("/")).text();

    expect(html).toContain("<title>BookingHub</title>");
    expect(html).toContain(`<link rel="canonical" href="${baseURL}/" />`);
    expect(html).toMatch(
      /<meta\s+name="description"\s+content="[^"]*manage your bookings/,
    );
    expect(html).toContain('<meta property="og:title" content="BookingHub" />');
    expect(html).toContain(`<meta property="og:url" content="${baseURL}/" />`);
    expect(html).not.toContain("%PUBLIC_URL%");
    expect(html).not.toContain('name="robots"');
  });

  test("describes the site with structured data", async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get("/")).text();

    const json = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    )?.[1];
    expect(JSON.parse(json!)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "BookingHub",
      url: baseURL,
    });
  });

  test("has one h1 and doesn't skip heading levels", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h2")).not.toHaveCount(0);
    await expect(page.locator("h3")).toHaveCount(0);
  });
});

test("the bookings page isn't indexed", async ({ page }) => {
  await page.goto("/bookings");

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex",
  );
});

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/sign-in isn't indexed", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );
    await expect(page.locator("h1")).toHaveCount(1);
  });
});

test("robots.txt allows the site and points to the sitemap", async ({
  request,
  baseURL,
}) => {
  const robots = await (await request.get("/robots.txt")).text();

  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain(`Sitemap: ${baseURL}/sitemap.xml`);
});

test("the sitemap lists public pages only", async ({ request, baseURL }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  const sitemap = await response.text();
  expect(sitemap).toContain(`<loc>${baseURL}</loc>`);
  expect(sitemap).not.toContain("/bookings");
  expect(sitemap).not.toContain("/sign-in");
});

test("sends security headers", async ({ request }) => {
  const { "x-powered-by": poweredBy, ...headers } = (
    await request.get("/")
  ).headers();

  expect(poweredBy).toBeUndefined();
  expect(headers).toMatchObject({
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=63072000; includeSubDomains",
  });
  // Every browser test also runs under this policy, and a violation is a
  // console error, which fails the test.
  const csp = headers["content-security-policy"];
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toContain("unsafe-inline");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
});

test("hashed assets are cached for a year, the page isn't", async ({
  request,
}) => {
  const page = await request.get("/");
  expect(page.headers()["cache-control"]).toBe("no-cache");

  const script = (await page.text()).match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  const asset = await request.get(script!);
  expect(asset.headers()["cache-control"]).toContain("immutable");
});
