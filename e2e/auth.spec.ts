import {
  bookingCard,
  createBooking,
  deleteSessionsFromDatabase,
  expect,
  gotoHydrated,
  KEYCLOAK_USERS,
  logInOnKeycloak,
  signedOut,
  signInAsNewUser,
  test,
} from "./support";

test.describe("signed out", () => {
  test.use(signedOut);

  test("the bookings page asks to sign in, then comes back through Keycloak", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/bookings?status=confirmed");

    await expect(page).toHaveURL(
      "/sign-in?returnTo=%2Fbookings%3Fstatus%3Dconfirmed",
    );
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await logInOnKeycloak(page, KEYCLOAK_USERS.ada);

    await expect(page).toHaveURL("/bookings?status=confirmed");
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
    const header = page.getByRole("banner");
    await expect(
      header.getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    if (!isMobile) {
      await expect(header.getByText(KEYCLOAK_USERS.ada.email)).toBeVisible();
    }
  });

  test("the header offers to sign in", async ({ page }) => {
    await gotoHydrated(page, "/");

    await page
      .getByRole("banner")
      .getByRole("link", { name: "Sign in" })
      .click();

    await expect(page).toHaveURL("/sign-in?returnTo=%2F");
  });

  test("ignores a return address on another site", async ({ page }) => {
    await page.goto("/sign-in?returnTo=https%3A%2F%2Fevil.example");
    await page.getByRole("link", { name: "Continue to sign in" }).click();
    await logInOnKeycloak(page, KEYCLOAK_USERS.grace);

    await expect(page).toHaveURL("/bookings");
  });

  test("a wrong password stays on Keycloak", async ({ page }) => {
    await page.goto("/auth/login");
    await logInOnKeycloak(page, { username: "ada", password: "wrong" });

    await expect(page.getByText("Invalid username or password.")).toBeVisible();
  });

  test("a callback without a sign-in in progress is refused", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=forged&state=forged");

    await expect(page).toHaveURL("/sign-in?error=Expired");
    await expect(page.getByRole("alert")).toContainText("took too long");
  });

  test("the session cookie is HttpOnly and SameSite", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/login");
    await logInOnKeycloak(page, KEYCLOAK_USERS.ada);
    await expect(page).toHaveURL("/bookings");

    const session = (await context.cookies()).find((c) => c.name === "session");
    expect(session).toMatchObject({ httpOnly: true, sameSite: "Lax" });
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "session=",
    );
  });
});

test.describe("when the session ends", () => {
  // The browser logs the API's 401 response as a console error.
  test.use({ ...signedOut, allowConsoleErrors: true });

  test("an action asks to sign in, then comes back", async ({
    page,
    context,
    baseURL,
  }) => {
    const email = await signInAsNewUser(context, baseURL!);
    const { title } = await createBooking(page.request);
    await gotoHydrated(page, "/bookings");
    await expect(bookingCard(page, title)).toBeVisible();

    await deleteSessionsFromDatabase(email);
    await bookingCard(page, title)
      .getByRole("button", { name: "Confirm" })
      .click();

    await expect(page).toHaveURL("/sign-in?returnTo=%2Fbookings");
  });
});

// These sign in as their own user: signing out, or losing a session, would
// otherwise end the session the other tests share.
test.describe("own session", () => {
  test.use(signedOut);

  test("signing out ends the Keycloak session too", async ({ page }) => {
    await page.goto("/auth/login?returnTo=/bookings");
    await logInOnKeycloak(page, KEYCLOAK_USERS.grace);
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();

    await page
      .getByRole("banner")
      .getByRole("button", { name: "Sign out" })
      .click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("banner").getByRole("link", { name: "Sign in" }),
    ).toBeVisible();
    // Keycloak asks for the password again: its own session ended as well.
    await page.goto("/auth/login");
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  });
});

test.describe("sign-in limits", () => {
  test.use(signedOut);

  test("starts at most 30 sign-ins per client in 15 minutes", async ({
    request,
  }) => {
    for (let started = 0; started < 30; started++) {
      const response = await request.get("/auth/login", { maxRedirects: 0 });
      expect(response.headers().location).toContain("/realms/booking/");
    }

    const refused = await request.get("/auth/login", { maxRedirects: 0 });

    expect(refused.headers().location).toBe("/sign-in?error=RateLimited");
  });
});
