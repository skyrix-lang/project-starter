import { PUBLIC_PATHS } from "@booking/core";

// Built from PUBLIC_URL at request time, so one image serves any domain.

export function robotsTxt(publicUrl: string) {
  return `User-Agent: *
Allow: /
Disallow: /api/
Disallow: /auth/

Sitemap: ${publicUrl}/sitemap.xml
`;
}

export function sitemapXml(publicUrl: string) {
  const urls = PUBLIC_PATHS.map(
    (path) => `  <url><loc>${publicUrl}${path === "/" ? "" : path}</loc></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}
