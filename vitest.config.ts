import { defineConfig } from "vitest/config";
import { UNIT_COVERAGE_OPTIONS } from "./scripts/coverage-options.ts";

// `yarn test:unit`: unit and component tests next to the code they test
// (*.test.ts, *.test.tsx). Node for pure logic and the BFF; jsdom for React.
export default defineConfig({
  test: {
    // Never real mail, even when the shell exports SMTP settings: an empty
    // SMTP_HOST means mail is only logged (apps/bff/src/mail.ts).
    env: { SMTP_HOST: "" },
    // Coverage of these suites alone (`yarn test:unit --coverage`), in V8's
    // raw format, so `yarn test:coverage` can merge it exactly with the e2e
    // tests' and check the minimums (scripts/coverage.ts).
    coverage: {
      provider: "custom",
      customProviderModule: "vitest-monocart-coverage",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.gen.ts",
        "packages/api/**",
        "packages/db/drizzle/**",
      ],
      // @ts-expect-error -- vitest-monocart-coverage's own option.
      coverageReportOptions: UNIT_COVERAGE_OPTIONS,
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
