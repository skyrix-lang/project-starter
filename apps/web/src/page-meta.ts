import { useEffect } from "react";
import { site } from "@booking/core";

/**
 * Sets the document title, and asks search engines not to index app screens.
 * Public pages leave `noindex` off. index.html holds the defaults that
 * crawlers see first.
 */
export function usePageMeta({
  title,
  noindex = false,
}: {
  title?: string;
  noindex?: boolean;
}) {
  useEffect(() => {
    document.title = title ? `${title} | ${site.name}` : site.name;
    if (!noindex) return;
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.append(meta);
    return () => meta.remove();
  }, [title, noindex]);
}
