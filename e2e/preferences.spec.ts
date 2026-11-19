import type { Page } from "@playwright/test";
import { expect, gotoHydrated, test } from "./support";

// The header's theme and language controls, remembered in this browser. Each
// test ends on the page it changed, so axe checks it in that theme or
// language.

/** The header, with the menu open on a phone, where the controls live there. */
async function header(page: Page) {
  const banner = page.getByRole("banner");
  const menu = banner.getByRole("button", {
    name: /^(Open menu|Ouvrir le menu)$/,
  });
  if (await menu.isVisible()) await menu.click();
  return banner;
}

test.describe("theme", () => {
  test("follows the system, then the visitor's choice", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await gotoHydrated(page, "/");
    const html = page.locator("html");
    await expect(html).toHaveClass(/\bdark\b/);

    const banner = await header(page);
    await banner.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);

    await banner.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(html).toHaveClass(/\bdark\b/);
  });

  test("the switch follows the system while the page is open", async ({
    page,
  }) => {
    await gotoHydrated(page, "/");
    const banner = await header(page);
    await expect(
      banner.getByRole("button", { name: "Switch to dark theme" }),
    ).toBeVisible();

    await page.emulateMedia({ colorScheme: "dark" });
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
    await expect(
      banner.getByRole("button", { name: "Switch to light theme" }),
    ).toBeVisible();
  });

  test("is dark from the first paint after a reload", async ({ page }) => {
    await gotoHydrated(page, "/");
    await (
      await header(page)
    )
      .getByRole("button", { name: "Switch to dark theme" })
      .click();

    // Hold the app's script back: only public/theme.js has run.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/assets/*.js", async (route) => {
      await held;
      await route.continue();
    });
    try {
      await page.reload({ waitUntil: "commit" });
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      await expect(page.getByRole("banner")).toHaveCount(0);
    } finally {
      release();
    }
    await expect(page.getByRole("banner")).toBeVisible();
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  });
});

test.describe("language", () => {
  test.describe("from the browser", () => {
    test.use({ locale: "fr-FR" });

    test("starts in the browser's language", async ({ page }) => {
      await page.goto("/");
      await expect(
        page.getByRole("heading", { name: "Réservez en toute confiance" }),
      ).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    });
  });

  test("switches from the header, and stays switched", async ({ page }) => {
    await gotoHydrated(page, "/");
    await (
      await header(page)
    )
      .getByRole("combobox", { name: "Language" })
      .selectOption("fr");

    const heading = page.getByRole("heading", {
      name: "Réservez en toute confiance",
    });
    await expect(heading).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");

    await page.reload();
    await expect(heading).toBeVisible();
    await expect(
      (await header(page)).getByRole("combobox", { name: "Langue" }),
    ).toHaveValue("fr");
  });
});
