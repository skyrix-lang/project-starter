import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { env } from "./env";

// Fails at startup, not on the first request, when a setting is missing.
let settings;
try {
  settings = env();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const server = serve(
  { fetch: createApp().fetch, port: settings.PORT, hostname: settings.HOST },
  (info) => console.log(`BFF listening on http://${info.address}:${info.port}`),
);

// Docker sends SIGTERM on stop: finish in-flight requests, then exit.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
