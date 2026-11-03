import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { seedBookings } from "@/lib/db/seed";
import { users } from "@/lib/db/schema";

// yarn db:seed <email>: gives that user the demo bookings. They must have signed
// in once, so the user exists: creating it here would stop Google sign-in from
// linking to it.
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: yarn db:seed <email of a user who has signed in>");
    process.exit(1);
  }

  loadEnvConfig(process.cwd());
  const db = drizzle(process.env.DATABASE_URL!);
  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (!user) {
      console.error(
        `No user ${email}: sign in once with it, then run this again.`,
      );
      process.exitCode = 1;
      return;
    }
    await seedBookings(db, user.id);
    console.log(`Demo bookings added for ${email}.`);
  } finally {
    await db.$client.end();
  }
}

main();
