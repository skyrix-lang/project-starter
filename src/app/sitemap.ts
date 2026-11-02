import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Public pages only: /bookings is an app screen, marked noindex.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: site.url }];
}
