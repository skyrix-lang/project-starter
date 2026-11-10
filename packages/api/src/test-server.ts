import { setupServer } from "msw/node";

/**
 * The MSW server for component tests (started in vitest.setup-dom.ts). A test
 * adds the handlers it needs: server.use(getListBookingsMockHandler([...])).
 */
export const server = setupServer();
