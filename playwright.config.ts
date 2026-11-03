import { defineConfig, devices } from "@playwright/test";
import { SIGNED_IN_STATE } from "./e2e/auth-state";

const PORT = 3100;
const HOST = "127.0.0.1";
// Next.js reports a 127.0.0.1 request as coming from "localhost", so Auth.js
// builds its redirects with that name. The browser uses it too, so cookies and
// redirects stay on one host.
const BASE_URL = `http://localhost:${PORT}`;

// Its own database, recreated on every run by e2e/reset-database.ts. Set on
// process.env so the server, and the test workers, use it instead of .env.
process.env.DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  "postgres://booking:booking@localhost:5432/booking_e2e";

process.env.NEXT_PUBLIC_SITE_URL = "https://bookinghub.test";

// Auth.js, for the server under test. Sign-in links are sent to Mailpit
// (`yarn mail:up`), where e2e/support.ts reads them. Google is configured with a
// fake client so its button shows; the tests never complete a Google sign-in.
Object.assign(process.env, {
  // Production builds require at least 32 characters (src/lib/env.ts).
  AUTH_SECRET: "e2e-secret-not-for-production-0123456789",
  AUTH_URL: BASE_URL,
  AUTH_EMAIL_SERVER: process.env.E2E_SMTP_URL ?? "smtp://localhost:1025",
  AUTH_EMAIL_FROM: "BookingHub <no-reply@bookinghub.test>",
  AUTH_GOOGLE_ID: "e2e-google-client",
  AUTH_GOOGLE_SECRET: "e2e-google-secret",
  AUTH_ALLOWED_EMAILS: "@example.test",
});

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: "auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "api",
      testMatch: "api.spec.ts",
      dependencies: ["setup"],
      use: { storageState: SIGNED_IN_STATE },
    },
    {
      name: "desktop",
      testIgnore: ["api.spec.ts", "auth.setup.ts"],
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], storageState: SIGNED_IN_STATE },
    },
    {
      name: "mobile",
      testIgnore: ["api.spec.ts", "auth.setup.ts"],
      dependencies: ["setup"],
      use: { ...devices["Pixel 7"], storageState: SIGNED_IN_STATE },
    },
  ],
  // Tests run against the production build, on its own port, so a running
  // `yarn dev` is left alone.
  webServer: {
    command:
      "yarn db:up && yarn mail:up && yarn tsx e2e/reset-database.ts && yarn build && yarn start",
    url: `http://${HOST}:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: {
      PORT: String(PORT),
      HOSTNAME: HOST,
    },
  },
});
