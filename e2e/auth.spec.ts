import {
  bookingCard,
  createBooking,
  deleteSessionsFromDatabase,
  expect,
  gotoHydrated,
  magicLinkFor,
  signedOut,
  signInByEmail,
  test,
  uniqueEmail,
} from "./support";

test.describe("signed out", () => {
  test.use(signedOut);

  test("the bookings page asks to sign in, then comes back", async ({
    page,
  }) => {
    await page.goto("/bookings?status=confirmed");

    await expect(page).toHaveURL(
      "/sign-in?callbackUrl=%2Fbookings%3Fstatus%3Dconfirmed",
    );
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
  });

  test("the header offers to sign in", async ({ page }) => {
    await gotoHydrated(page, "/");

    await page
      .getByRole("banner")
      .getByRole("link", { name: "Sign in" })
      .click();

    await expect(page).toHaveURL("/sign-in?callbackUrl=%2F");
  });

  test("offers Google and email", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });

  test("a magic link signs in and returns to the requested page", async ({
    page,
    isMobile,
  }) => {
    const email = await signInByEmail(page, {
      callbackUrl: "/bookings?status=pending",
    });

    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    if (!isMobile) await expect(header.getByText(email)).toBeVisible();
  });

  test("a magic link works only once", async ({ page, browser }) => {
    const email = uniqueEmail();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();
    await expect(
      page.getByRole("heading", { name: "Check your email" }),
    ).toBeVisible();
    const link = await magicLinkFor(email);
    await page.goto(link);
    await expect(page).toHaveURL("/bookings");

    const other = await browser.newContext(signedOut);
    const otherPage = await other.newPage();
    await otherPage.goto(link);

    await expect(otherPage.getByRole("main").getByRole("alert")).toContainText(
      "expired or was already used",
    );
    await other.close();
  });

  test("ignores a callback URL on another site", async ({ page }) => {
    await signInByEmail(page, { callbackUrl: "/bookings" });
    await page.goto("/sign-in?callbackUrl=https%3A%2F%2Fevil.example");

    await expect(page).toHaveURL("/bookings");
  });

  test("rejects an invalid email address", async ({ page }) => {
    await gotoHydrated(page, "/sign-in");

    // The browser accepts "ada@localhost"; the server requires a real domain.
    await page.getByLabel("Email").fill("ada@localhost");
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("ada@localhost");
  });

  test("refuses an address outside the allowlist", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByLabel("Email").fill(uniqueEmail("outside.test"));
    await page.getByRole("button", { name: "Email me a sign-in link" }).click();

    await expect(
      page.getByText("This email address isn't allowed to sign in."),
    ).toBeVisible();
  });
});

// These sign in as their own user: signing out, or losing a session, would
// otherwise end the session the other tests share.
test.describe("own session", () => {
  test.use(signedOut);

  test("signing out", async ({ page }) => {
    await signInByEmail(page);

    await page
      .getByRole("banner")
      .getByRole("button", { name: "Sign out" })
      .click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    await page.goto("/bookings");
    await expect(page).toHaveURL(/\/sign-in\?/);
  });

  test("an action after the session ends asks to sign in", async ({ page }) => {
    const email = await signInByEmail(page);
    const { title } = await createBooking(page.request);
    await page.goto("/bookings");

    await deleteSessionsFromDatabase(email);
    await bookingCard(page, title)
      .getByRole("button", { name: "Confirm" })
      .click();

    await expect(page).toHaveURL("/sign-in?callbackUrl=%2Fbookings");
  });
});
