import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "@booking/api/test-server";
// Components read their texts from i18next: English, as the tests expect.
import { startI18n } from "./apps/web/src/i18n";

// jsdom has no scrolling; the router restores scroll positions.
window.scrollTo = () => {};

startI18n();

// Component tests talk to MSW, never to a real server: an unhandled request
// fails the test.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
