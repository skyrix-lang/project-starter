import { loadEnvConfig } from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { seedBookings } from "@/lib/db/seed";

async function main() {
  loadEnvConfig(process.cwd());
  const db = drizzle(process.env.DATABASE_URL!);
  await seedBookings(db);
  await db.$client.end();
}

main();
