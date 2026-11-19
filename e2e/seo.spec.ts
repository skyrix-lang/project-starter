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
    expect(html).toContain(
      '<meta property="og:site_name" content="BookingHub" />',
    );
    // The site's language, such as en_US or fr_FR.
    expect(html).toMatch(
      /<meta property="og:locale" content="[a-z]{2,3}_[A-Z]{2}" \/>/,
    );
    expect(html).toContain(
      `<meta property="og:image" content="${baseURL}/og-image.png" />`,
    );
    expect(html).toContain(
      '<meta name="twitter:card" content="summary_large_image" />',
    );
    expect(html).toContain(
      `<meta name="twitter:image" content="${baseURL}/og-image.png" />`,
    );
    expect(html).not.toContain("%PUBLIC_URL%");
    expect(html).not.toContain('name="robots"');
  });

  test("describes the site with structured data", async ({
    request,
    baseURL,
  }) => {
    const html = await (await request.get("/")).text();

    const json = JSON.parse(
      html.match(
        /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
      )![1]!,
    );
    expect(json["@context"]).toBe("https://schema.org");
    // One item, or several in an @graph.
    const items: Record<string, unknown>[] = json["@graph"] ?? [json];
    expect(items).toContainEqual(
      expect.objectContaining({
        "@type": "WebSite",
        name: "BookingHub",
        url: `${baseURL}/`,
      }),
    );
    const organization = items.find((item) => item["@type"] === "Organization");
    if (organization) {
      // Its logo must be a file the site serves.
      const logo = await request.get(String(organization.logo));
      expect(logo.status()).toBe(200);
    }
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
  expect(sitemap).toContain(`<loc>${baseURL}/</loc>`);
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

test("the share image is served", async ({ request }) => {
  const image = await request.get("/og-image.png");

  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toBe("image/png");
});

test("a page sets its own title and link preview once loaded", async ({
  page,
  baseURL,
}) => {
  await page.goto("/bookings");

  await expect(page).toHaveTitle("Bookings | BookingHub");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Bookings | BookingHub",
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    `${baseURL}/bookings`,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `${baseURL}/bookings`,
  );
});

test("sends the build's brotli and gzip files to browsers that accept them", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  const script = html.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  const plain = await request.get(script!, {
    headers: { "Accept-Encoding": "identity" },
  });
  expect(plain.headers()["content-encoding"]).toBeUndefined();
  expect(plain.headers()["vary"]).toBe("Accept-Encoding");

  for (const encoding of ["br", "gzip"]) {
    const compressed = await request.get(script!, {
      headers: { "Accept-Encoding": encoding },
    });
    expect(compressed.headers()["content-encoding"]).toBe(encoding);
    expect(compressed.headers()["vary"]).toBe("Accept-Encoding");
    expect(Number(compressed.headers()["content-length"])).toBeLessThan(
      (await plain.body()).length / 2,
    );
    // Playwright decodes it: the same file.
    expect(await compressed.body()).toEqual(await plain.body());
  }

  const page = await request.get("/", { headers: { "Accept-Encoding": "br" } });
  expect(page.headers()["content-encoding"]).toBe("br");
  expect(await page.text()).toBe(html);
});

test("an unknown address answers 404, with the app's not-found page", async ({
  page,
}) => {
  const response = await page.goto("/no-such-page");

  expect(response!.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Page not found" }),
  ).toBeVisible();
});

test("serves the icons search results and phones ask for", async ({
  request,
}) => {
  for (const [path, type] of [
    ["/favicon.ico", "image/x-icon"],
    ["/apple-touch-icon.png", "image/png"],
  ]) {
    const response = await request.get(path!);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toBe(type);
  }
});
