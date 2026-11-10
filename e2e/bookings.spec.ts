import { SIGNED_IN_STATE } from "./auth-state";
import {
  bookingCard,
  createBooking,
  deleteBookingFromDatabase,
  expect,
  gotoHydrated,
  setBookingStatus,
  signedOut,
  signInAsNewUser,
  test,
} from "./support";

test("lists the bookings and sets the title", async ({ page }) => {
  await page.goto("/bookings");

  await expect(page).toHaveTitle("Bookings | BookingHub");
  await expect(bookingCard(page, "Team Sync")).toBeVisible();
  await expect(bookingCard(page, "Project Review")).toBeVisible();
  await expect(bookingCard(page, "Client Call")).toBeVisible();
});

test.describe("filters", () => {
  test("filter links update the list and the URL", async ({ page }) => {
    await page.goto("/bookings");
    const filters = page.getByRole("navigation", { name: "Filter bookings" });
    await expect(filters.getByRole("link", { name: "All" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await filters.getByRole("link", { name: "Confirmed" }).click();

    await expect(page).toHaveURL("/bookings?status=confirmed");
    await expect(
      filters.getByRole("link", { name: "Confirmed" }),
    ).toHaveAttribute("aria-current", "page");
    await expect(bookingCard(page, "Team Sync")).toBeVisible();
    await expect(bookingCard(page, "Project Review")).toBeHidden();

    await filters.getByRole("link", { name: "All" }).click();

    await expect(page).toHaveURL("/bookings");
    await expect(bookingCard(page, "Project Review")).toBeVisible();
  });

  test("an unknown status shows every booking", async ({ page }) => {
    await page.goto("/bookings?status=bogus");

    await expect(bookingCard(page, "Team Sync")).toBeVisible();
    await expect(bookingCard(page, "Project Review")).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Filter bookings" })
        .getByRole("link", { name: "All" }),
    ).toHaveAttribute("aria-current", "page");
  });
});

test.describe("actions", () => {
  test("confirming a booking", async ({ page, request }) => {
    const { title } = await createBooking(request);
    await page.goto("/bookings");
    const card = bookingCard(page, title);
    await expect(card.getByText("pending", { exact: true })).toBeVisible();

    await card.getByRole("button", { name: "Confirm" }).click();

    await expect(card.getByText("confirmed", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Confirm" })).toBeHidden();
    await expect(card.getByRole("button", { name: "Cancel" })).toBeVisible();

    await page.reload();

    await expect(card.getByText("confirmed", { exact: true })).toBeVisible();
  });

  test("cancelling a booking", async ({ page, request }) => {
    const { title } = await createBooking(request);
    await page.goto("/bookings");
    const card = bookingCard(page, title);

    await card.getByRole("button", { name: "Cancel" }).click();

    await expect(card.getByText("cancelled", { exact: true })).toBeVisible();
    await expect(card.getByRole("button", { name: "Cancel" })).toBeHidden();
    await expect(card.getByRole("button", { name: "Confirm" })).toBeVisible();
  });

  test("disables the buttons while the change is saved", async ({
    page,
    request,
  }) => {
    const { title } = await createBooking(request);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route("**/api/bookings/*", async (route) => {
      if (route.request().method() === "PATCH") await held;
      await route.continue();
    });
    await gotoHydrated(page, "/bookings");
    const card = bookingCard(page, title);
    const confirm = card.getByRole("button", { name: "Confirm" });

    await confirm.click();

    await expect(confirm).toBeDisabled();
    await expect(card.getByRole("button", { name: "Cancel" })).toBeDisabled();
    release();
    await expect(card.getByText("confirmed", { exact: true })).toBeVisible();
  });
});

test.describe("new booking", () => {
  test("creates a booking from the form", async ({ page }) => {
    const title = `Form ${Date.now()}`;
    await gotoHydrated(page, "/bookings");

    await page.getByRole("button", { name: "New booking" }).click();
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("From the form");
    await page.getByLabel("Date").fill("2030-04-01");
    await page.getByLabel("Time").fill("08:15");
    await page.getByLabel("Duration (minutes)").fill("45");
    await page.getByRole("button", { name: "Save booking" }).click();

    const card = bookingCard(page, title);
    await expect(card).toBeVisible();
    await expect(card.getByText("2030-04-01 at 08:15")).toBeVisible();
    await expect(card.getByText("pending", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save booking" }),
    ).toBeHidden();
  });

  test("shows what's wrong without sending anything", async ({ page }) => {
    let posted = false;
    await page.route("**/api/bookings", async (route) => {
      if (route.request().method() === "POST") posted = true;
      await route.continue();
    });
    await gotoHydrated(page, "/bookings");
    await page.getByRole("button", { name: "New booking" }).click();

    await page.getByRole("button", { name: "Save booking" }).click();

    await expect(page.getByText("Enter a title.")).toBeVisible();
    await expect(page.getByLabel("Title")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(posted).toBe(false);
  });
});

test.describe("page and API share the same data", () => {
  test("a booking created through the API appears on the page", async ({
    page,
    request,
  }) => {
    const { title } = await createBooking(request);

    await page.goto("/bookings");

    await expect(bookingCard(page, title)).toBeVisible();
  });

  test("a status set through the API appears on the page", async ({
    page,
    request,
  }) => {
    const { id, title } = await createBooking(request);

    await setBookingStatus(request, id, "cancelled");
    await page.goto("/bookings?status=cancelled");

    await expect(bookingCard(page, title)).toBeVisible();
  });

  test("a status set on the page appears in the API", async ({
    page,
    request,
  }) => {
    const { id, title } = await createBooking(request);
    await page.goto("/bookings");
    const card = bookingCard(page, title);

    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(card.getByText("confirmed", { exact: true })).toBeVisible();

    const bookings = await (
      await request.get("/api/bookings?status=confirmed")
    ).json();
    expect(bookings).toContainEqual(expect.objectContaining({ id }));
  });
});

test("shows a skeleton while the bookings load", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/bookings", async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/bookings");

  const skeleton = page.getByRole("status", { name: "Loading bookings" });
  await expect(skeleton).toBeVisible();
  release();
  await expect(bookingCard(page, "Team Sync")).toBeVisible();
  await expect(skeleton).toBeHidden();
});

test.describe("a booking removed by someone else", () => {
  // The browser logs the API's 404 response as a console error.
  test.use({ allowConsoleErrors: true });

  test("leaves the list", async ({ page, request }) => {
    const { id, title } = await createBooking(request);
    await page.goto("/bookings");
    const card = bookingCard(page, title);
    await expect(card).toBeVisible();

    await deleteBookingFromDatabase(id);
    await card.getByRole("button", { name: "Confirm" }).click();

    await expect(card).toBeHidden();
    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
  });
});

test.describe("when a change fails", () => {
  test.use({ allowConsoleErrors: true });

  test("shows the error page and recovers on retry", async ({
    page,
    request,
  }) => {
    const { title } = await createBooking(request);
    let failing = true;
    await page.route("**/api/bookings/*", async (route) => {
      if (failing && route.request().method() === "PATCH") {
        await route.fulfill({ status: 500, json: { error: "Boom" } });
      } else {
        await route.continue();
      }
    });
    await gotoHydrated(page, "/bookings");

    await bookingCard(page, title)
      .getByRole("button", { name: "Confirm" })
      .click();

    await expect(
      page.getByRole("heading", { name: "Something went wrong" }),
    ).toBeVisible();

    failing = false;
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(bookingCard(page, title)).toBeVisible();
  });
});

test.describe("another user", () => {
  test.use(signedOut);

  test("can't see or change someone else's bookings", async ({
    page,
    context,
    playwright,
    baseURL,
  }) => {
    const owner = await playwright.request.newContext({
      baseURL,
      storageState: SIGNED_IN_STATE,
    });
    const { id, title } = await createBooking(owner);
    await signInAsNewUser(context, baseURL!);
    await page.goto("/bookings");

    await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible();
    await expect(page.getByText("No bookings found.")).toBeVisible();
    await expect(bookingCard(page, title)).toBeHidden();
    expect(await (await page.request.get("/api/bookings")).json()).toEqual([]);

    const update = await page.request.patch(`/api/bookings/${id}`, {
      data: { status: "cancelled" },
    });
    expect(update.status()).toBe(404);

    const ownersView = await (await owner.get("/api/bookings")).json();
    expect(ownersView).toContainEqual(
      expect.objectContaining({ id, status: "pending" }),
    );
    await owner.dispose();
  });
});
