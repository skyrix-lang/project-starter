import { randomBytes, randomUUID } from "node:crypto";
import {
  expect,
  test as base,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { Client } from "pg";
import type { Booking } from "@/types";

/**
 * Every test also fails on a browser console error or uncaught exception, which
 * is how hydration mismatches show up. Tests that trigger an error on purpose
 * opt out with `test.use({ allowConsoleErrors: true })`.
 */
export const test = base.extend<{
  allowConsoleErrors: boolean;
  failOnConsoleError: void;
}>({
  // Sign-in emails are rate limited per client address, which the app reads
  // from x-forwarded-for. Each test gets its own, as if from its own machine, so
  // parallel tests don't share a limit.
  // (`provide` is Playwright's `use`, renamed so it isn't taken for React's.)
  extraHTTPHeaders: async ({ extraHTTPHeaders }, provide) => {
    await provide({ ...extraHTTPHeaders, "x-forwarded-for": randomIp() });
  },
  allowConsoleErrors: [false, { option: true }],
  failOnConsoleError: [
    async ({ page, allowConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(error.message));

      await use();

      if (!allowConsoleErrors) expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** An address in 198.18.0.0/15, a range reserved for testing. */
function randomIp() {
  const [a, b, c] = randomBytes(3);
  return `198.${18 + (a % 2)}.${b}.${c}`;
}

/**
 * Tests run in parallel against one database, so a test that changes data
 * creates its own booking, with a unique title, and leaves the seed data alone.
 */
export async function createBooking(
  request: APIRequestContext,
  overrides: Partial<Booking> = {},
): Promise<Booking> {
  const response = await request.post("/api/bookings", {
    data: {
      title: `E2E ${randomUUID()}`,
      description: "Created by a test",
      date: "2030-01-15",
      time: "10:30",
      duration: 30,
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  return response.json();
}

export async function setBookingStatus(
  request: APIRequestContext,
  id: string,
  status: Booking["status"],
) {
  const response = await request.patch(`/api/bookings/${id}`, {
    data: { status },
  });
  expect(response.ok()).toBe(true);
}

/** Removes a row directly: the app has no delete, and this mimics another user. */
export async function deleteBookingFromDatabase(id: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query("DELETE FROM bookings WHERE id = $1", [id]);
  } finally {
    await db.end();
  }
}

/**
 * Opens a page and waits for React to hydrate, for tests that depend on client
 * behaviour. Links only start prefetching once hydrated, so the first prefetch
 * is the signal. The page must have a link to another route in the viewport.
 */
export async function gotoHydrated(page: Page, url: string) {
  await Promise.all([
    page.waitForResponse((response) =>
      new URL(response.url()).searchParams.has("_rsc"),
    ),
    page.goto(url),
  ]);
}

export function bookingCard(page: Page, title: string) {
  return page
    .getByTestId("booking-card")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";

/** A new address for each call, inside the test allowlist (@example.test). */
export function uniqueEmail(domain = "example.test") {
  return `e2e-${randomUUID()}@${domain}`;
}

/** For tests that start signed out, or sign in as their own user. */
export const signedOut = { storageState: { cookies: [], origins: [] } };

/** Waits for the sign-in email sent to `email` and returns its link. */
export async function magicLinkFor(email: string): Promise<string> {
  let id: string | undefined;
  await expect
    .poll(
      async () => {
        const response = await fetch(
          `${MAILPIT_URL}/api/v1/search?${new URLSearchParams({ query: `to:"${email}"` })}`,
        );
        const { messages } = await response.json();
        id = messages[0]?.ID;
        return id;
      },
      { message: `no sign-in email for ${email}` },
    )
    .toBeTruthy();

  const message = await (
    await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)
  ).json();
  const link = (message.Text as string).match(/https?:\/\/\S+/)?.[0];
  expect(link, "the email contains a link").toBeTruthy();
  return link!;
}

/**
 * Signs in through the real magic-link flow: requests a link, reads it from
 * Mailpit and follows it. Ends on `callbackUrl`.
 */
export async function signInByEmail(
  page: Page,
  { email = uniqueEmail(), callbackUrl = "/bookings" } = {},
) {
  await page.goto(`/sign-in?${new URLSearchParams({ callbackUrl })}`);
  await requestSignInLink(page, email);
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();

  await page.goto(await magicLinkFor(email));
  await expect(page).toHaveURL(callbackUrl);
  return email;
}

/** Submits the email form on the sign-in page, which must be open. */
export async function requestSignInLink(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
}

/** Ends a user's sessions directly in the database, as if they had expired. */
export async function deleteSessionsFromDatabase(email: string) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = $1)",
      [email],
    );
  } finally {
    await db.end();
  }
}
