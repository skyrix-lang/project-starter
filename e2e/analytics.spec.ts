import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import type { Page } from "@playwright/test";
import { expect, gotoHydrated, test as base } from "./support";

// Google Analytics is off unless the server has a measurement id. The main
// test server has none; these tests start a second one, from the same build,
// with an id, so the page, the CSP and the banner are the real ones. Google
// itself is never reached: the library's address answers a stand-in.

const MEASUREMENT_ID = "G-E2ETEST1";

/** What the app (apps/web/src/analytics.ts) adds to the window. */
type AnalyticsWindow = Window & {
  dataLayer?: IArguments[];
  [disable: `ga-disable-${string}`]: boolean | undefined;
};

/** A port nothing listens on. */
function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

async function startServer(): Promise<{ url: string; server: ChildProcess }> {
  const port = await freePort();
  const url = `http://localhost:${port}`;
  const server = spawn(process.execPath, ["apps/bff/dist/server.js"], {
    // The test server's settings (playwright.config.ts), plus an id.
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_URL: url,
      GA_MEASUREMENT_ID: MEASUREMENT_ID,
      LOG_LEVEL: "warn",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  for (const started = Date.now(); Date.now() - started < 20_000;) {
    const healthy = await fetch(`${url}/api/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (healthy) return { url, server };
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  server.kill();
  throw new Error("The analytics test server didn't start");
}

const test = base.extend<
  { libraryRequests: string[] },
  { analyticsServer: string }
>({
  analyticsServer: [
    // oxlint-disable-next-line no-empty-pattern -- Playwright reads a fixture's dependencies from this pattern
    async ({}, provide) => {
      const { url, server } = await startServer();
      await provide(url);
      server.kill();
    },
    { scope: "worker" },
  ],
  // Every test in this file talks to that server, and the console and axe
  // checks (e2e/support.ts) follow.
  baseURL: async ({ analyticsServer }, provide) => provide(analyticsServer),
  // Requests for Google's library, answered by a stand-in that marks itself loaded.
  libraryRequests: async ({ page }, provide) => {
    const requests: string[] = [];
    await page.route("https://www.googletagmanager.com/**", (route) => {
      requests.push(route.request().url());
      return route.fulfill({
        contentType: "text/javascript",
        body: "window.gaStandIn = true;",
      });
    });
    await provide(requests);
  },
});

const banner = (page: Page) => page.getByRole("region", { name: "Cookies" });
const libraryLoaded = (page: Page) =>
  page.evaluate(() => "gaStandIn" in window);

test("asks first, and loads nothing from Google until then", async ({
  page,
  libraryRequests,
}) => {
  await gotoHydrated(page, "/");

  await expect(banner(page)).toBeVisible();
  await expect(banner(page)).toContainText("Google Analytics");
  await expect(page.getByRole("button", { name: "Decline" })).toBeVisible();
  expect(libraryRequests).toEqual([]);
  expect(await page.evaluate(() => document.cookie)).not.toContain("_ga");
  // The test ends with the banner open: axe checks it.
});

test("a refusal loads nothing, and is remembered", async ({
  page,
  libraryRequests,
}) => {
  await gotoHydrated(page, "/");
  await page.getByRole("button", { name: "Decline" }).click();

  await expect(banner(page)).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Cookie settings" }),
  ).toBeFocused();
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(banner(page)).toBeHidden();
  expect(libraryRequests).toEqual([]);
});

test("accepting loads Google's library, with consent denied by default", async ({
  page,
  libraryRequests,
}) => {
  await gotoHydrated(page, "/");
  await page.getByRole("button", { name: "Accept" }).click();

  await expect(banner(page)).toBeHidden();
  await expect.poll(() => libraryLoaded(page)).toBe(true);
  expect(libraryRequests).toEqual([
    `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`,
  ]);
  const commands = await page.evaluate(() =>
    ((window as unknown as AnalyticsWindow).dataLayer ?? []).map((entry) => [
      ...entry,
    ]),
  );
  expect(commands[0]).toEqual([
    "consent",
    "default",
    expect.objectContaining({
      analytics_storage: "denied",
      ad_storage: "denied",
    }),
  ]);
  expect(commands).toContainEqual([
    "consent",
    "update",
    { analytics_storage: "granted" },
  ]);

  // The next visit measures from the start, without asking.
  await page.reload();
  await expect.poll(() => libraryLoaded(page)).toBe(true);
  await expect(banner(page)).toBeHidden();
});

test("cookie settings changes the answer, by keyboard", async ({
  page,
  libraryRequests,
}) => {
  await gotoHydrated(page, "/");
  await page.getByRole("button", { name: "Accept" }).click();
  await expect.poll(() => libraryLoaded(page)).toBe(true);

  const settings = page.getByRole("button", { name: "Cookie settings" });
  await settings.focus();
  await page.keyboard.press("Enter");
  await expect(banner(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(banner(page)).toBeHidden();
  await expect(settings).toBeFocused();

  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Decline" })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(banner(page)).toBeHidden();
  await expect(settings).toBeFocused();
  expect(
    await page.evaluate(
      (id) => (window as unknown as AnalyticsWindow)[`ga-disable-${id}`],
      MEASUREMENT_ID,
    ),
  ).toBe(true);
  libraryRequests.length = 0;
  await page.reload();
  await expect(page.getByRole("banner")).toBeVisible();
  expect(libraryRequests).toEqual([]);
});

base.describe("without a measurement id", () => {
  base(
    "there is no banner, no cookie settings, and no Google in the CSP",
    async ({ page }) => {
      const response = await page.goto("/");
      await expect(page.getByRole("banner")).toBeVisible();

      await expect(banner(page)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Cookie settings" }),
      ).toHaveCount(0);
      expect(response!.headers()["content-security-policy"]).not.toContain(
        "google",
      );
    },
  );
});
