import { expect, test } from "./support";

test.describe("home page", () => {
  test("shows the hero, features and title", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("BookingHub");
    await expect(
      page.getByRole("heading", { name: "Book with confidence" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Instant Confirmation" }),
    ).toBeVisible();
  });

  test("loads the logo", async ({ page }) => {
    await page.goto("/");

    const logo = page.getByRole("banner").locator('img[src="/logo.svg"]');
    await expect(logo).toBeVisible();
    await expect
      .poll(() => logo.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  });

  test("links to the bookings", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("link", { name: "View Bookings" }).click();

    await expect(page).toHaveURL("/bookings");
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  });
});

test.describe("header", () => {
  test("desktop navigation", async ({ page, isMobile }) => {
    test.skip(isMobile, "the desktop navigation is hidden on mobile");
    await page.goto("/");
    const menuButton = page.getByRole("button", { name: "Open menu" });
    await expect(menuButton).toBeHidden();

    await page
      .getByRole("banner")
      .getByRole("link", { name: "Bookings" })
      .click();

    await expect(page).toHaveURL("/bookings");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Bookings" }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("mobile menu", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the mobile menu is hidden on desktop");
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Bookings" })).toBeHidden();

    await header.getByRole("button", { name: "Open menu" }).click();

    await expect(
      header.getByRole("button", { name: "Close menu" }),
    ).toHaveAttribute("aria-expanded", "true");

    await header.getByRole("link", { name: "Bookings" }).click();

    await expect(page).toHaveURL("/bookings");
    await expect(header.getByRole("link", { name: "Bookings" })).toBeHidden();
    await expect(
      header.getByRole("button", { name: "Open menu" }),
    ).toBeVisible();
  });
});

test.describe("unknown pages", () => {
  test("show the not-found page, which isn't indexed", async ({ page }) => {
    // The server can't tell which paths the SPA knows, so it answers 200 and
    // the page asks search engines not to index it.
    await page.goto("/does-not-exist");

    await expect(page).toHaveTitle("Page not found | BookingHub");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex",
    );

    await page.getByRole("link", { name: "Back to home" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });

  test("an unknown API path is a JSON 404, not the app", async ({
    request,
  }) => {
    const response = await request.get("/api/does-not-exist");

    expect(response.status()).toBe(404);
    expect(response.headers()["content-type"]).toContain("application/json");
  });
});
