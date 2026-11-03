import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { sessions, users } from "@/lib/db/schema";
import { seedBookings } from "@/lib/db/seed";

// yarn dev:session [email] [--seed]: signs a user in without the email round
// trip, for an agent or a person checking the running dev server. It writes a
// session row, as Auth.js would, and prints the cookie. Local databases only.

const STATE_FILE = "e2e/.auth/dev-session.json";

async function main() {
  const args = process.argv.slice(2);
  const seed = args.includes("--seed");
  const email = (
    args.find((arg) => !arg.startsWith("--")) ?? "agent@example.test"
  )
    .trim()
    .toLowerCase();

  loadEnvConfig(process.cwd());
  const url = new URL(process.env.DATABASE_URL!);
  if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`Refusing: ${url.hostname} isn't a local database.`);
  }
  const site = new URL(process.env.AUTH_URL ?? "http://localhost:3000");
  if (site.protocol !== "http:") {
    throw new Error("Refusing: AUTH_URL isn't a local http:// address.");
  }

  const db = drizzle(url.href);
  try {
    const [user] = await db
      .insert(users)
      .values({ email, emailVerified: new Date() })
      .onConflictDoUpdate({ target: users.email, set: { email } })
      .returning({ id: users.id });

    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await db
      .insert(sessions)
      .values({ sessionToken, userId: user.id, expires });
    if (seed) await seedBookings(db, user.id);

    // Auth.js's cookie name over plain HTTP. On HTTPS it gets a __Secure- prefix.
    const cookie = { name: "authjs.session-token", value: sessionToken };
    mkdirSync("e2e/.auth", { recursive: true });
    writeFileSync(
      STATE_FILE,
      JSON.stringify({
        cookies: [
          {
            ...cookie,
            domain: site.hostname,
            path: "/",
            expires: Math.floor(expires.getTime() / 1000),
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ],
        origins: [],
      }),
    );

    console.log(`Signed in as ${email}${seed ? ", with the demo bookings" : ""}.
  curl:        curl -H 'Cookie: ${cookie.name}=${cookie.value}' ${site.origin}/bookings
  Playwright:  storageState: "${STATE_FILE}"
  browser:     set the cookie ${cookie.name} on ${site.hostname}`);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
