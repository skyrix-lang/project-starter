import { describe, expect, it } from "vitest";
import { routeMatcher, routePaths } from "./routes";

describe("routePaths", () => {
  it("reads the full paths of a generated route tree", () => {
    const tree = `
export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/admin/': typeof AdminIndexRoute
  '/events/$id': typeof EventsIdRoute
}
export interface FileRoutesByTo {
  '/other': typeof OtherRoute
}`;
    expect(routePaths(tree)).toEqual(["/", "/admin/", "/events/$id"]);
  });

  it("refuses a file that isn't a route tree", () => {
    expect(() => routePaths("export const x = 1")).toThrow(/route tree/);
  });
});

describe("routeMatcher", () => {
  const matches = routeMatcher([
    "/",
    "/bookings",
    "/admin/",
    "/events/$id",
    "/files/{$name}.pdf",
    "/posts/{-$page}",
    "/docs/$",
  ]);

  it.each([
    "/",
    "/bookings",
    "/bookings/",
    "/Bookings",
    "/admin",
    "/admin/",
    "/events/42",
    "/files/report.pdf",
    "/posts",
    "/posts/2",
    "/docs",
    "/docs/a/b/c",
    "/events/caf%C3%A9",
  ])("knows %s", (path) => {
    expect(matches(path)).toBe(true);
  });

  it.each([
    "/nope",
    "/bookings/extra",
    "/events",
    "/events/42/more",
    "/files/report.txt",
    "/posts/2/3",
    "/%E0%A4%A",
  ])("doesn't know %s", (path) => {
    expect(matches(path)).toBe(false);
  });

  it("matches everything under a catch-all route", () => {
    const all = routeMatcher(["/", "/$"]);
    expect(all("/anything/at/all")).toBe(true);
  });
});
