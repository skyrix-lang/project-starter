import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { users } from "@booking/db";
import { seedBookings } from "@booking/db/seed";
import { loadEnv } from "./env";

// yarn db:seed <email>: gives that user the demo bookings. They must have signed
// in once, so the user exists and is linked to their identity.
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: yarn db:seed <email of a user who has signed in>");
    process.exit(1);
  }

  loadEnv();
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
