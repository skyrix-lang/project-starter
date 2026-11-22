// A scenario: one person's whole journey through the bookings feature, as
// they'd live it, in one test. The other bookings tests check each behaviour
// on its own; this one checks that the steps work one after the other, with
// the state each leaves behind. How to write one: the `e2e-scenario` skill.
import {
  bookingCard,
  expect,
  gotoHydrated,
  signedOut,
  signInAsNewUser,
  test,
} from "./support";

test.use(signedOut);

test("a new user books, confirms, finds and cancels a meeting", async ({
  page,
  context,
  baseURL,
}) => {
  const title = `Kick-off ${Date.now()}`;
  const filters = page.getByRole("navigation", { name: "Filter bookings" });

  await test.step("a new user has no bookings yet", async () => {
    await signInAsNewUser(context, baseURL!);
    await gotoHydrated(page, "/bookings");
    await expect(page.getByText("No bookings found.")).toBeVisible();
  });

  await test.step("a mistake is shown before anything is sent", async () => {
    await page.getByRole("button", { name: "New booking" }).click();
    await page.getByRole("button", { name: "Save booking" }).click();
    await expect(page.getByText("Enter a title.")).toBeVisible();
  });

  await test.step("they book a meeting", async () => {
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Description").fill("Plan the first sprint");
    await page.getByLabel("Date").fill("2031-03-12");
    await page.getByLabel("Time").fill("10:30");
    await page.getByLabel("Duration (minutes)").fill("60");
    await page.getByRole("button", { name: "Save booking" }).click();

    await expect(
      page.getByRole("dialog", { name: "Booking saved" }),
    ).toBeVisible();
    const card = bookingCard(page, title);
    await expect(card.getByText("Mar 12, 2031 at 10:30")).toBeVisible();
    await expect(card.getByText("pending", { exact: true })).toBeVisible();
    await expect(page.getByText("No bookings found.")).toBeHidden();
  });

  await test.step("they confirm it, and it's under Confirmed", async () => {
    await bookingCard(page, title)
      .getByRole("button", { name: "Confirm" })
      .click();
    await expect(
      bookingCard(page, title).getByText("confirmed", { exact: true }),
    ).toBeVisible();

    await filters.getByRole("link", { name: "Confirmed" }).click();
    await expect(page).toHaveURL("/bookings?status=confirmed");
    await expect(bookingCard(page, title)).toBeVisible();
    await filters.getByRole("link", { name: "Pending" }).click();
    await expect(bookingCard(page, title)).toBeHidden();
  });

  await test.step("it's still there after a reload", async () => {
    await filters.getByRole("link", { name: "All" }).click();
    await page.reload();
    await expect(
      bookingCard(page, title).getByText("confirmed", { exact: true }),
    ).toBeVisible();
  });

  await test.step("they cancel it, and it's under Cancelled", async () => {
    await bookingCard(page, title)
      .getByRole("button", { name: "Cancel" })
      .click();
    await expect(
      bookingCard(page, title).getByRole("button", { name: "Confirm" }),
    ).toBeVisible();

    await filters.getByRole("link", { name: "Cancelled" }).click();
    await expect(bookingCard(page, title)).toBeVisible();
    await filters.getByRole("link", { name: "Confirmed" }).click();
    await expect(page.getByText("No bookings found.")).toBeVisible();
  });
});
