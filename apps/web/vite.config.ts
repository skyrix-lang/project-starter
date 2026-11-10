import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { bffDevPort, devPort } from "../../scripts/checkout.ts";

// In development, Vite serves the app and forwards the BFF's paths to it, so
// the browser sees one origin, as in production (where the BFF serves the
// build). WEB_PORT and PORT come from the repository's .env (`yarn setup`).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const port = Number(env.WEB_PORT ?? devPort());
  const bff = `http://localhost:${env.PORT ?? bffDevPort()}`;
  const publicUrl = env.PUBLIC_URL ?? `http://localhost:${port}`;

  return {
    plugins: [
      // Generates src/routeTree.gen.ts from src/routes. Before react().
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      devPublicUrl(publicUrl),
    ],
    server: {
      port,
      strictPort: true,
      proxy: Object.fromEntries(
        ["/api", "/auth", "/robots.txt", "/sitemap.xml"].map((path) => [
          path,
          { target: bff },
        ]),
      ),
    },
    build: { sourcemap: true },
  };
});

/** The BFF fills %PUBLIC_URL% in index.html when it serves it; in development, Vite does. */
function devPublicUrl(url: string): Plugin {
  return {
    name: "dev-public-url",
    apply: "serve",
    transformIndexHtml: (html) => html.replaceAll("%PUBLIC_URL%", url),
  };
}
