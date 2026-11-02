import { randomUUID } from "node:crypto";
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
