import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { routePaths } from "../../packages/core/src/routes.ts";
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
      devPlaceholders({
        PUBLIC_URL: publicUrl,
        GA_MEASUREMENT_ID: env.GA_MEASUREMENT_ID ?? "",
      }),
      routesManifest(),
      precompress(),
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
    build: {
      sourcemap: true,
      // `yarn test:coverage` (scripts/coverage.ts): unminified, so the e2e
      // tests' coverage counts each file's statements as Vitest does. Only
      // that local and nightly test build: the image's build minifies.
      minify: process.env.E2E_COVERAGE ? false : undefined,
      rolldownOptions: {
        output: {
          codeSplitting: {
            // zod and its settings (src/zod-config.ts) in one chunk: every
            // chunk with a schema loads it first, so the settings apply
            // before any schema is made, however the rest is split.
            groups: [
              {
                name: "zod",
                test: /[\\/]node_modules[\\/]zod[\\/]|[\\/]src[\\/]zod-config\.ts$/,
              },
            ],
          },
        },
      },
    },
  };
});

/**
 * The BFF fills %PUBLIC_URL% and %GA_MEASUREMENT_ID% in index.html when it
 * serves it; in development, Vite does, from the repository's .env.
 */
function devPlaceholders(values: Record<string, string>): Plugin {
  return {
    name: "dev-placeholders",
    apply: "serve",
    transformIndexHtml: (html) =>
      Object.entries(values).reduce(
        (page, [name, value]) => page.replaceAll(`%${name}%`, value),
        html,
      ),
  };
}

/**
 * Writes `routes.json`, the app's route paths, from the route tree TanStack
 * Router generated: the BFF answers 404 for an address that matches none
 * (apps/bff/src/app.ts).
 */
export function routesManifest(): Plugin {
  let root = "";
  return {
    name: "routes-manifest",
    apply: "build",
    configResolved: (config) => {
      root = config.root;
    },
    generateBundle: async function () {
      const tree = await readFile(join(root, "src/routeTree.gen.ts"), "utf8");
      this.emitFile({
        type: "asset",
        fileName: "routes.json",
        source: `${JSON.stringify(routePaths(tree), null, 2)}\n`,
      });
    },
  };
}

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

/**
 * Writes a brotli (`.br`) and a gzip (`.gz`) copy next to each text file of the
 * build, at the strongest settings, so the BFF serves them without
 * compressing on every request (apps/bff/src/app.ts). Not index.html, which
 * the BFF fills in and compresses when it starts, nor source maps, which only
 * developer tools load. Files under 1 kB aren't worth it.
 */
export function precompress(): Plugin {
  let outDir = "";
  return {
    name: "precompress",
    apply: "build",
    configResolved: (config) => {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle: {
      order: "post",
      sequential: true,
      handler: async () => {
        const files = await readdir(outDir, { recursive: true });
        await Promise.all(
          files
            .filter(
              (file) =>
                /\.(js|mjs|css|html|svg|json|txt|xml|webmanifest)$/.test(
                  file,
                ) && file !== "index.html",
            )
            .map(async (file) => {
              const path = join(outDir, file);
              if ((await stat(path)).size < 1024) return;
              const source = await readFile(path);
              const [br, gz] = await Promise.all([
                brotli(source, {
                  params: {
                    [constants.BROTLI_PARAM_QUALITY]:
                      constants.BROTLI_MAX_QUALITY,
                    [constants.BROTLI_PARAM_SIZE_HINT]: source.length,
                  },
                }),
                gzipAsync(source, { level: constants.Z_BEST_COMPRESSION }),
              ]);
              await Promise.all([
                writeFile(`${path}.br`, br),
                writeFile(`${path}.gz`, gz),
              ]);
            }),
        );
      },
    },
  };
}
