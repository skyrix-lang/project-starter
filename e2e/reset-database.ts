import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { users } from "@booking/db";
import { seedBookings } from "@booking/db/seed";
import { SHARED_USER_EMAIL } from "./auth-state";

// Recreates the test database, so every run starts from the same state.
async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const name = url.pathname.slice(1);
  if (!name.endsWith("_e2e")) {
    throw new Error(`Refusing to reset "${name}": it isn't a test database`);
  }

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.href });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.query(`CREATE DATABASE "${name}"`);
  await admin.end();

  const db = drizzle(url.href);
  await migrate(db, { migrationsFolder: "packages/db/drizzle" });
  const [user] = await db
    .insert(users)
    .values({ email: SHARED_USER_EMAIL })
    .returning();
  await seedBookings(db, user!.id);
  await db.$client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
