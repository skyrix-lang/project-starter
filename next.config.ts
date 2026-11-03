import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// A static policy, so public pages stay static. A nonce-based one would be
// stricter, but needs every page rendered per request. Next.js inlines scripts
// and styles, hence 'unsafe-inline'; React needs 'unsafe-eval' in development
// only. Add the origins of any third-party script, image or API here.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  // Without JavaScript, "Continue with Google" is a form whose response
  // redirects to Google, and browsers check that redirect against form-action.
  "form-action 'self' https://accounts.google.com",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker runtime.
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Browsers ignore it over plain HTTP, so local development is unaffected.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
