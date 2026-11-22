import { defineConfig } from "vitest/config";

// `yarn test:unit`: unit and component tests next to the code they test
// (*.test.ts, *.test.tsx). Node for pure logic and the BFF; jsdom for React.
export default defineConfig({
  test: {
    // Never real mail, even when the shell exports SMTP settings: an empty
    // SMTP_HOST means mail is only logged (apps/bff/src/mail.ts).
    env: { SMTP_HOST: "" },
    // `yarn test:coverage`, which the nightly runs: fails if coverage drops
    // below these minimums. Raise them when coverage goes up, never lower
    // them to make a run pass (docs/development.md, "Coverage").
    coverage: {
      provider: "v8",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.gen.ts",
        "packages/api/**",
        "packages/db/drizzle/**",
      ],
      reporter: ["text-summary", "html"],
      thresholds: { statements: 66, branches: 62, functions: 66, lines: 67 },
    },
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
