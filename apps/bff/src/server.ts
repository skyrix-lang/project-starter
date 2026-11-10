import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./env";
import { log } from "./log";

// Fails at startup, not on the first request, when a setting is missing.
let settings;
try {
  settings = env();
} catch (error) {
  // Plain text: the log's own settings are among what failed to load.
  // oxlint-disable-next-line no-console -- the logger isn't configured yet
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const server = serve(
  { fetch: createApp().fetch, port: settings.PORT, hostname: settings.HOST },
  (info) => log.info("Listening", { address: info.address, port: info.port }),
);

// Docker sends SIGTERM on stop: finish in-flight requests, then exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    log.info("Shutting down", { signal });
    server.close(() => process.exit(0));
  });
}
