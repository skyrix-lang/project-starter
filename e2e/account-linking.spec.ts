import {
  bookingCard,
  createUserWithBooking,
  expect,
  KEYCLOAK_USERS,
  logInOnKeycloak,
  signedOut,
  test,
} from "./support";

// apps/bff/src/users.ts: a user created ahead of their first sign-in (by
// `yarn dev:session`, or by email in advance) keeps their data, but only when
// the provider has verified the email. Each case uses its own Keycloak user,
// and runs once: the first sign-in is the one that links.
test.describe.configure({ mode: "serial" });
test.use(signedOut);

test("a verified email links to the existing user and their bookings", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the first sign-in links; run it once");
  const title = "Booked before signing in";
  await createUserWithBooking(KEYCLOAK_USERS.linus.email, title);

  await page.goto("/auth/login?returnTo=/bookings");
  await logInOnKeycloak(page, KEYCLOAK_USERS.linus);

  await expect(bookingCard(page, title)).toBeVisible();
});

test("an unverified email doesn't take over someone's account", async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, "the first sign-in links; run it once");
  const title = "The victim's booking";
  await createUserWithBooking(KEYCLOAK_USERS.mallory.email, title);

  await page.goto("/auth/login?returnTo=/bookings");
  await logInOnKeycloak(page, KEYCLOAK_USERS.mallory);

  await expect(page.getByText("No bookings found.")).toBeVisible();
  await expect(bookingCard(page, title)).toBeHidden();
  // Nor does the unverified address show as theirs.
  await expect(page.getByRole("banner")).not.toContainText(
    "victim@example.test",
  );
});
