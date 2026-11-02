import { expect, test } from "./support";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

test.describe("home page", () => {
  test("has a canonical URL and social metadata", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("BookingHub");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`^${SITE_URL}/?$`),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /manage your bookings/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      "content",
      "BookingHub",
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "BookingHub",
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary_large_image",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("links to a generated social image", async ({ page, request }) => {
    await page.goto("/");

    const url = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(url).toContain(`${SITE_URL}/opengraph-image`);

    const image = await request.get(new URL(url!).pathname);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toBe("image/png");
  });

  test("describes the site with structured data", async ({ request }) => {
    const html = await (await request.get("/")).text();

    const json = html.match(
      /<script type="application\/ld\+json">(.*?)<\/script>/,
    )?.[1];
    expect(JSON.parse(json!)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "BookingHub",
      url: SITE_URL,
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
    /noindex/,
  );
});

test("robots.txt allows the site and points to the sitemap", async ({
  request,
}) => {
  const robots = await (await request.get("/robots.txt")).text();

  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test("the sitemap lists public pages only", async ({ request }) => {
  const response = await request.get("/sitemap.xml");

  expect(response.status()).toBe(200);
  const sitemap = await response.text();
  expect(sitemap).toContain(`<loc>${SITE_URL}</loc>`);
  expect(sitemap).not.toContain("/bookings");
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
  });
});
