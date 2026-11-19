// The SPA's routes, known to the server too, so an address that matches none
// gets a real 404 status (with the app's own "Page not found" page) rather
// than a 200 that search engines report as a "soft 404". The build writes
// them to routes.json (apps/web/vite.config.ts); the BFF reads that file.

/**
 * The route paths in a TanStack Router route tree (`routeTree.gen.ts`), such
 * as `/`, `/bookings` and `/events/$id`: the keys of its
 * `FileRoutesByFullPath` interface.
 */
export function routePaths(routeTree: string): string[] {
  const body = routeTree.match(
    /export interface FileRoutesByFullPath \{([^}]*)\}/,
  )?.[1];
  if (!body) throw new Error("No FileRoutesByFullPath in the route tree");
  return [...body.matchAll(/^\s*'([^']+)':/gm)].map((match) => match[1]!);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const withoutTrailingSlash = (path: string) =>
  path.length > 1 ? path.replace(/\/+$/, "") : path;

/** One route path as a regular expression, following TanStack Router's syntax. */
function routeRegex(route: string) {
  const segments = withoutTrailingSlash(route).split("/").slice(1);
  let source = "";
  for (const segment of segments) {
    if (segment === "$") {
      // A splat: anything, including nothing.
      source += "(?:/.*)?";
    } else if (/^\{-\$\w+\}$/.test(segment)) {
      // An optional parameter.
      source += "(?:/[^/]+)?";
    } else {
      // A parameter (`$id`), possibly with a prefix or suffix (`{$id}.json`).
      const pattern = segment
        .split(/(\{\$\w+\}|^\$\w+$)/)
        .map((part) =>
          /^\{\$\w+\}$|^\$\w+$/.test(part) ? "[^/]+" : escape(part),
        )
        .join("");
      source += `/${pattern}`;
    }
  }
  // Paths match regardless of case, as TanStack Router's do by default.
  return new RegExp(`^${source || "/"}$`, "i");
}

/** A test for whether a request path is one of the app's routes. */
export function routeMatcher(routes: readonly string[]) {
  const patterns = routes.map(routeRegex);
  return (path: string) => {
    let decoded = path;
    try {
      decoded = decodeURI(path);
    } catch {
      // Malformed escapes: match the path as sent.
    }
    const normalized = withoutTrailingSlash(decoded) || "/";
    return patterns.some((pattern) => pattern.test(normalized));
  };
}
