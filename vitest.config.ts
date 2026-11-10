import { defineConfig } from "vitest/config";

// `yarn test:unit`: unit and component tests next to the code they test
// (*.test.ts, *.test.tsx). Node for pure logic and the BFF; jsdom for React.
export default defineConfig({
  test: {
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
