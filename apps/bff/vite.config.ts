import { defineConfig } from "vite";

// `yarn build` bundles the server and every dependency into dist/server.js,
// so the runtime image needs no node_modules.
export default defineConfig({
  build: {
    ssr: "src/server.ts",
    outDir: "dist",
    target: "node22",
    sourcemap: true,
  },
  ssr: {
    target: "node",
    noExternal: true,
    // Optional native bindings that pg tries to load; not used.
    external: ["pg-native"],
  },
});
