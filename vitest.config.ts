import { defineConfig } from "vitest/config";

// `yarn test:unit`: unit and component tests next to the code they test
// (*.test.ts, *.test.tsx). Node for pure logic and the BFF; jsdom for React.
export default defineConfig({
  test: {
    // Never real mail, even when the shell exports SMTP settings: an empty
    // SMTP_HOST means mail is only logged (apps/bff/src/mail.ts).
    env: { SMTP_HOST: "" },
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: [
            "packages/{core,db}/src/**/*.test.ts",
            "apps/bff/src/**/*.test.ts",
            "scripts/**/*.test.ts",
          ],
        },
      },
      {
        test: {
          name: "dom",
          environment: "jsdom",
          include: [
            "packages/{ui,feature-*}/src/**/*.test.{ts,tsx}",
            "apps/web/src/**/*.test.{ts,tsx}",
          ],
          setupFiles: ["./vitest.setup-dom.ts"],
        },
      },
    ],
  },
});
