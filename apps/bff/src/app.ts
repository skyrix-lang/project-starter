import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, type MiddlewareHandler } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { routeMatcher } from "@booking/core";
import { requestId, type RequestIdVariables } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { negotiateEncoding, precompress } from "./compression";
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
  const { PUBLIC_URL, OIDC_ISSUER, STATIC_DIR, GA_MEASUREMENT_ID } = env();
  // Google Analytics, only when a measurement id is set: its script, and
  // where it sends measurements (Google's CSP guide for GA4). The browser
  // loads it only once the visitor has accepted (apps/web/src/analytics.ts).
  const analytics = GA_MEASUREMENT_ID
    ? {
        script: ["https://*.googletagmanager.com"],
        img: [
          "https://*.google-analytics.com",
          "https://*.googletagmanager.com",
        ],
        connect: [
          "https://*.google-analytics.com",
          "https://*.analytics.google.com",
          "https://*.googletagmanager.com",
        ],
      }
    : { script: [], img: [], connect: [] };
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
        scriptSrc: ["'self'", ...analytics.script],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:", ...analytics.img],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", ...analytics.connect],
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

  // One address per page: the `www.` twin of PUBLIC_URL's host (or the bare
  // domain, when PUBLIC_URL has `www.`) is sent there for good, so search
  // engines don't index the site twice. Only that twin: a proxy that passes
  // its own upstream name (app:3000) or an address must not loop.
  const canonical = new URL(PUBLIC_URL);
  const twin = canonical.hostname.startsWith("www.")
    ? canonical.hostname.slice(4)
    : `www.${canonical.hostname}`;
  app.use(async (c, next) => {
    const url = new URL(c.req.url);
    const read = c.req.method === "GET" || c.req.method === "HEAD";
    if (!read || url.hostname !== twin) return next();
    return c.redirect(`${PUBLIC_URL}${url.pathname}${url.search}`, 301);
  });

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
  // Crawlers fetch these often; an hour's cache spares the server.
  app.get("/robots.txt", (c) => {
    c.header("Cache-Control", "public, max-age=3600");
    return c.text(robotsTxt(PUBLIC_URL));
  });
  app.get("/sitemap.xml", (c) =>
    c.body(sitemapXml(PUBLIC_URL), 200, {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    }),
  );

  if (STATIC_DIR) {
    // The page's canonical URL and social metadata need the public address,
    // and analytics its measurement id (validated in env.ts, empty when off):
    // both are set when the container starts, not when it was built.
    const index = readFileSync(join(STATIC_DIR, "index.html"), "utf8")
      .replaceAll("%PUBLIC_URL%", PUBLIC_URL)
      .replaceAll("%GA_MEASUREMENT_ID%", GA_MEASUREMENT_ID ?? "");
    const compressedIndex = precompress(index);
    // The app's routes, from the build (routes.json): an address that matches
    // none gets the app's not-found page with a 404 status, so search engines
    // drop it. A build without the file answers 200 everywhere, as before.
    const routesFile = join(STATIC_DIR, "routes.json");
    const isAppRoute = existsSync(routesFile)
      ? routeMatcher(JSON.parse(readFileSync(routesFile, "utf8")) as string[])
      : () => true;
    // A file of the build, or its `.br` or `.gz` copy when the browser accepts
    // it (apps/web/vite.config.ts writes them). serveStatic matches bare
    // tokens only (`gzip`, not `gzip;q=0.8`), which is what browsers send; a
    // client that weighs its encodings may get the file uncompressed, never in
    // an encoding it refused. index.html, below, honours the weights. Every file says it varies by
    // Accept-Encoding, so a cache never hands a brotli copy to a browser that
    // can't read it. Headers go on the response serveStatic returns: it
    // replaces any set on the context meanwhile.
    const files = (cacheControl?: string): MiddlewareHandler => {
      const serve = serveStatic({ root: STATIC_DIR, precompressed: true });
      return async (c, next) => {
        const response = await serve(c, next);
        if (response) {
          response.headers.set("Vary", "Accept-Encoding");
          if (cacheControl) response.headers.set("Cache-Control", cacheControl);
        }
        return response;
      };
    };
    // Hashed file names never change, so they're cached for a year.
    app.use("/assets/*", files("public, max-age=31536000, immutable"));
    // Other files of the build (logo.svg, og-image.png), by name. A path
    // without an extension is a client route, handled below.
    // index.html only through the route below, with PUBLIC_URL filled in; a
    // missing file is a 404, not the app's page.
    app.get("/index.html", (c) => c.redirect("/", 301));
    app.get("/:file{[^/]+\\.[a-z0-9]+}", files());
    app.get("/:file{[^/]+\\.[a-z0-9]+}", (c) => c.text("Not found", 404));
    // Every other path is the SPA's page: a route's (200), or its not-found
    // page (404) for an address that matches no route.
    app.get("*", (c) => {
      c.header("Cache-Control", "no-cache");
      c.header("Vary", "Accept-Encoding");
      const status = isAppRoute(c.req.path) ? 200 : 404;
      const encoding = negotiateEncoding(c.req.header("Accept-Encoding"));
      if (!encoding) return c.html(index, status);
      return c.body(compressedIndex[encoding], status, {
        "Content-Type": "text/html; charset=UTF-8",
        "Content-Encoding": encoding,
      });
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
