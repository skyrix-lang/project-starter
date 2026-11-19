import { useEffect } from "react";
import { site } from "@booking/core";

export interface PageMeta {
  /** Shown as "<title> | BookingHub"; the site's name alone when unset. */
  title?: string;
  /** About 150 characters, for search results and link previews. */
  description?: string;
  /** The link preview's image: a path on this site or an absolute URL, 1200 × 630. */
  image?: string;
  /** What the image shows, for people who can't see it. */
  imageAlt?: string;
  /** Open Graph's type: `article` for a dated piece of content. */
  type?: "website" | "article";
  /** App screens and error pages: ask search engines not to index them. */
  noindex?: boolean;
  /** Structured data for this page (schema.org), such as an `Event` or `FAQPage`. */
  jsonLd?: Record<string, unknown>;
}

export const DEFAULT_IMAGE = "/og-image.png";

/**
 * The public address, from the canonical link the BFF filled in with
 * PUBLIC_URL: the address a proxy serves may differ from the one that ranks.
 */
function publicOrigin() {
  const canonical = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  try {
    return new URL(canonical?.href ?? "").origin;
  } catch {
    return window.location.origin;
  }
}

function setMeta(attribute: "name" | "property", key: string, value: string) {
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute(attribute, key);
    document.head.append(meta);
  }
  meta.content = value;
}

/** JSON for a script element: `<` escaped, so no value can close the element. */
export const jsonForScript = (data: unknown) =>
  JSON.stringify(data).replace(/</g, "\\u003c");

/**
 * Sets the page's title, description, canonical URL, link-preview metadata
 * (Open Graph and X) and structured data, and asks search engines not to index
 * app screens. Every page calls it, so each sets every value: what it leaves
 * out falls back to the site's defaults, never to the previous page's.
 * index.html holds the home page's values, which crawlers see first.
 */
export function usePageMeta({
  title,
  description = site.description,
  image = DEFAULT_IMAGE,
  imageAlt = `The ${site.name} logo`,
  type = "website",
  noindex = false,
  jsonLd,
}: PageMeta) {
  // An object literal is new on every render: compare its content instead.
  const structuredData = jsonLd ? jsonForScript(jsonLd) : undefined;

  useEffect(() => {
    const origin = publicOrigin();
    const pageTitle = title ? `${title} | ${site.name}` : site.name;
    const url = origin + window.location.pathname;
    const imageUrl = new URL(image, origin).href;

    document.title = pageTitle;
    document.head
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.setAttribute("href", url);
    setMeta("name", "description", description);
    setMeta("property", "og:type", type);
    setMeta("property", "og:title", pageTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:image", imageUrl);
    setMeta("property", "og:image:alt", imageAlt);
    setMeta("name", "twitter:title", pageTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
    setMeta("name", "twitter:image:alt", imageAlt);
    // The default image's size and type are known; a page's own may differ.
    const size = { width: "1200", height: "630", type: "image/png" };
    for (const [key, value] of Object.entries(size)) {
      if (image === DEFAULT_IMAGE)
        setMeta("property", `og:image:${key}`, value);
      else
        document.head
          .querySelector(`meta[property="og:image:${key}"]`)
          ?.remove();
    }

    const added: HTMLElement[] = [];
    if (noindex) {
      const robots = document.createElement("meta");
      robots.name = "robots";
      robots.content = "noindex";
      added.push(robots);
    }
    if (structuredData) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.textContent = structuredData;
      added.push(script);
    }
    document.head.append(...added);
    return () => {
      for (const element of added) element.remove();
    };
  }, [title, description, image, imageAlt, type, noindex, structuredData]);
}
