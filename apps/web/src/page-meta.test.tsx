import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { site } from "@booking/core";
import { usePageMeta } from "./page-meta";

// What index.html holds once the BFF has filled in PUBLIC_URL.
beforeEach(() => {
  document.head.innerHTML = `
    <link rel="canonical" href="https://bookings.example.com/" />
    <meta property="og:image:width" content="1200" />
  `;
  window.history.replaceState(null, "", "/events/42");
});
afterEach(() => window.history.replaceState(null, "", "/"));

const meta = (selector: string) =>
  document.head.querySelector<HTMLMetaElement>(`meta[${selector}]`)?.content;

describe("usePageMeta", () => {
  it("gives every link preview the page's title, address and description", () => {
    renderHook(() =>
      usePageMeta({ title: "Concert", description: "A summer concert." }),
    );

    expect(document.title).toBe(`Concert | ${site.name}`);
    const url = "https://bookings.example.com/events/42";
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href"),
    ).toBe(url);
    expect(meta('property="og:url"')).toBe(url);
    expect(meta('property="og:title"')).toBe(`Concert | ${site.name}`);
    expect(meta('name="twitter:title"')).toBe(`Concert | ${site.name}`);
    expect(meta('name="description"')).toBe("A summer concert.");
    expect(meta('property="og:description"')).toBe("A summer concert.");
    expect(meta('name="twitter:description"')).toBe("A summer concert.");
  });

  it("falls back to the site's description and share image", () => {
    renderHook(() => usePageMeta({}));

    expect(document.title).toBe(site.name);
    expect(meta('name="description"')).toBe(site.description);
    expect(meta('property="og:image"')).toBe(
      "https://bookings.example.com/og-image.png",
    );
    expect(meta('name="twitter:image"')).toBe(
      "https://bookings.example.com/og-image.png",
    );
    expect(meta('property="og:image:width"')).toBe("1200");
  });

  it("takes a page's own image, and drops the default one's size", () => {
    renderHook(() =>
      usePageMeta({ image: "/posters/42.jpg", imageAlt: "The poster" }),
    );

    expect(meta('property="og:image"')).toBe(
      "https://bookings.example.com/posters/42.jpg",
    );
    expect(meta('property="og:image:alt"')).toBe("The poster");
    expect(meta('name="twitter:image:alt"')).toBe("The poster");
    expect(meta('property="og:image:width"')).toBeUndefined();
  });

  it("adds the page's structured data, and removes it on leaving", () => {
    const { unmount } = renderHook(() =>
      usePageMeta({
        jsonLd: { "@type": "Event", name: "</script><script>alert(1)" },
      }),
    );

    const script = document.head.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(script?.textContent).not.toContain("</script>");
    expect(JSON.parse(script!.textContent!)).toEqual({
      "@type": "Event",
      name: "</script><script>alert(1)",
    });
    unmount();
    expect(
      document.head.querySelector('script[type="application/ld+json"]'),
    ).toBeNull();
  });

  it("asks search engines not to index app screens, until they're left", () => {
    const { unmount } = renderHook(() =>
      usePageMeta({ title: "Bookings", noindex: true }),
    );

    expect(meta('name="robots"')).toBe("noindex");
    unmount();
    expect(meta('name="robots"')).toBeUndefined();
  });
});
