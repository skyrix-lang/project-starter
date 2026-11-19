import { PUBLIC_PATHS } from "@booking/core";

// Built from PUBLIC_URL at request time, so one image serves any domain.

/**
 * Lets crawlers in everywhere but the API and the sign-in redirects. App pages
 * stay crawlable on purpose: they say `noindex` themselves, which a crawler
 * only sees if it may load them.
 */
export function robotsTxt(publicUrl: string) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /auth/

Sitemap: ${publicUrl}/sitemap.xml
`;
}

const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!,
  );

/**
 * The public pages, at the same address as their canonical link (the home page
 * with its trailing slash, as index.html gives it).
 */
export function sitemapXml(publicUrl: string) {
  const urls = PUBLIC_PATHS.map(
    (path) => `  <url><loc>${escapeXml(publicUrl + path)}</loc></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
