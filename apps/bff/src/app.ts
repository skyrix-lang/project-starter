import { readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { env } from "./env";
import { log, withLogContext } from "./log";
import { api, openApiDocument } from "./routes/api";
import { authRoutes } from "./routes/auth";
import { robotsTxt, sitemapXml } from "./seo";

/**
 * The whole server: security headers, the API, the sign-in redirects and, in
 * production, the built SPA. Tests call `createApp().request(...)`.
 */
export function createApp() {
  const { PUBLIC_URL, OIDC_ISSUER, STATIC_DIR } = env();
  const app = new Hono<{ Variables: RequestIdVariables }>();

  // Every request gets an id (the proxy's `x-request-id` when it sent one),
  // returned in the response and added to each line logged while handling it,
  // so one request's lines can be found together. Then one line per request,
  // with the path only: a query string can carry a sign-in code.
  app.use(requestId());
  app.use(async (c, next) => {
    const started = performance.now();
    await withLogContext({ requestId: c.var.requestId }, next);
    const { status } = c.res;
    // The platform probes this every few seconds: only failures are news.
    if (c.req.path === "/api/health" && status === 200) return;
    log[status >= 500 ? "error" : "info"]("Request", {
      requestId: c.var.requestId,
      method: c.req.method,
      path: c.req.path,
      status,
      durationMs: Math.round(performance.now() - started),
    });
  });

  app.use(
    secureHeaders({
      // Vite emits no inline scripts, so scripts come from this origin only.
      // Add the origins of any third-party script, image or API here.
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        // Signing out is a form whose response redirects to the provider.
        formAction: ["'self'", new URL(OIDC_ISSUER).origin],
        frameAncestors: ["'none'"],
      },
      strictTransportSecurity: "max-age=63072000; includeSubDomains",
      xFrameOptions: "DENY",
      referrerPolicy: "strict-origin-when-cross-origin",
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Refuses form posts from other sites. JSON from another origin is already
  // refused by the browser: there is no CORS, so its preflight fails. The
  // session cookie is also SameSite=Lax.
  app.use(csrf({ origin: PUBLIC_URL }));

  // Public, like the API's shape itself: the routes still check the session.
  app.get("/api/openapi.json", (c) => c.json(openApiDocument()));
  app.route("/api", api);
  app.route("/auth", authRoutes);
  // Unknown API and auth paths are JSON 404s, never the SPA's page.
  app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));
  app.all("/auth/*", (c) => c.json({ error: "Not found" }, 404));
  app.get("/robots.txt", (c) => c.text(robotsTxt(PUBLIC_URL)));
  app.get("/sitemap.xml", (c) =>
    c.body(sitemapXml(PUBLIC_URL), 200, { "Content-Type": "application/xml" }),
  );

  if (STATIC_DIR) {
    // The page's canonical URL and social metadata need the public address,
    // which is set when the container starts, not when it was built.
    const index = readFileSync(
      join(STATIC_DIR, "index.html"),
      "utf8",
    ).replaceAll("%PUBLIC_URL%", PUBLIC_URL);
    // Hashed file names never change, so they're cached for a year.
    app.use(
      "/assets/*",
      serveStatic({
        root: STATIC_DIR,
        onFound: (_path, c) => {
          c.header("Cache-Control", "public, max-age=31536000, immutable");
        },
      }),
    );
    // Other files of the build (logo.svg, icon.svg), by name. A path without an
    // extension is a client route, handled below.
    // index.html only through the route below, with PUBLIC_URL filled in; a
    // missing file is a 404, not the app's page.
    app.get("/index.html", (c) => c.redirect("/", 301));
    app.get("/:file{[^/]+\\.[a-z0-9]+}", serveStatic({ root: STATIC_DIR }));
    app.get("/:file{[^/]+\\.[a-z0-9]+}", (c) => c.text("Not found", 404));
    // Every other path is a client route: the SPA decides what to show.
    app.get("*", (c) => {
      c.header("Cache-Control", "no-cache");
      return c.html(index);
    });
  }

  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((error, c) => {
    if (error instanceof HTTPException) {
      return c.json({ error: error.message }, error.status);
    }
    log.error("Unhandled error", { error });
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
