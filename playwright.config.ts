import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const HOST = "127.0.0.1";

// Its own database, recreated on every run by e2e/reset-database.ts. Set on
// process.env so the server, and the test workers, use it instead of .env.
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://booking:booking@localhost:5432/booking_e2e";

process.env.NEXT_PUBLIC_SITE_URL = "https://bookinghub.test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://${HOST}:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "api",
      testMatch: "api.spec.ts",
    },
    {
      name: "desktop",
      testIgnore: "api.spec.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testIgnore: "api.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
  ],
  // Tests run against the production build, on its own port, so a running
  // `yarn dev` is left alone.
  webServer: {
    command:
      "yarn db:up && yarn tsx e2e/reset-database.ts && yarn build && yarn start",
    url: `http://${HOST}:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      HOSTNAME: HOST,
    },
  },
});
