import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@booking/api/test-server";

// jsdom has no scrolling; the router restores scroll positions.
window.scrollTo = () => {};

// Component tests talk to MSW, never to a real server: an unhandled request
// fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
