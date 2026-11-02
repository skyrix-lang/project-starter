import { expect, test } from "./support";

test.describe("home page", () => {
  test("is server-rendered", async ({ request }) => {
    const html = await (await request.get("/")).text();

    expect(html).toContain("confidence");
    expect(html).toContain("Easy Scheduling");
  });

  test("shows the hero, features and metadata", async ({ page }) => {
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

    const logo = page.getByRole("img", { name: "Logo" });
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
  // The browser logs the 404 response itself as a console error.
  test.use({ allowConsoleErrors: true });

  test("show the 404 page", async ({ page }) => {
    const response = await page.goto("/does-not-exist");

    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle("Page not found | BookingHub");

    await page.getByRole("link", { name: "Back to home" }).click();

    await expect(page).toHaveURL("/");
  });
});
