import type { ReactNode } from "react";
import type { FileRoutesByTo } from "./routeTree.gen";

type Page<Props> = (props: Props) => ReactNode;

/**
 * A customer's replacements for a package's pages, by route. Checked at build
 * time: a route that doesn't exist is a type error. Empty in the default app.
 *
 *   import { MyBookingsPage } from "./pages/my-bookings";
 *   export const pageOverrides: PageOverrides = { "/bookings": MyBookingsPage };
 *
 * A replacement takes the same props as the page it replaces.
 */
export type PageOverrides = Partial<Record<keyof FileRoutesByTo, Page<never>>>;

export const pageOverrides: PageOverrides = {};

/** The page to render for `route`: the override, if there is one. */
export function pageFor<Props>(
  route: keyof FileRoutesByTo,
  page: Page<Props>,
): Page<Props> {
  return (pageOverrides[route] as Page<Props> | undefined) ?? page;
}
