import { mkdirSync, writeFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/node-postgres";
import { seedBookings } from "@booking/db/seed";
import { loadEnv } from "./env";
import {
  createLocalSession,
  LOCAL_SESSION_COOKIE,
  storageState,
} from "./local-session";

// yarn dev:session [email] [--seed]: signs a user in without Keycloak, for an
// agent or a person checking the running dev server, and prints the cookie.
// Local databases and http:// only.

const STATE_FILE = "e2e/.auth/dev-session.json";

async function main() {
  const args = process.argv.slice(2);
  const seed = args.includes("--seed");
  const email = (
    args.find((arg) => !arg.startsWith("--")) ?? "agent@example.test"
  )
    .trim()
    .toLowerCase();

  loadEnv();
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`Refusing: ${url.hostname} isn't a local database.`);
  }
  const site = new URL(process.env.PUBLIC_URL ?? "http://localhost:3000");
  if (site.protocol !== "http:") {
    throw new Error("Refusing: PUBLIC_URL isn't a local http:// address.");
  }

  const db = drizzle(url.href);
  try {
    const { userId, token, expiresAt } = await createLocalSession(db, email);
    if (seed) await seedBookings(db, userId);

    mkdirSync("e2e/.auth", { recursive: true });
    writeFileSync(
      STATE_FILE,
      JSON.stringify(storageState(site, token, expiresAt)),
    );

    console.log(`Signed in as ${email}${seed ? ", with the demo bookings" : ""}.
  curl:        curl -H 'Cookie: ${LOCAL_SESSION_COOKIE}=${token}' ${site.origin}/api/bookings
  Playwright:  storageState: "${STATE_FILE}"
  browser:     set the cookie ${LOCAL_SESSION_COOKIE} on ${site.hostname}`);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
