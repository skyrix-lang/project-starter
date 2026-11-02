import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { bookings } from "./schema";

const DEMO_BOOKINGS: (typeof bookings.$inferInsert)[] = [
  {
    title: "Team Sync",
    description: "Weekly team standup meeting",
    date: "2026-03-10",
    time: "09:00",
    duration: 30,
    status: "confirmed",
  },
  {
    title: "Project Review",
    description: "Q1 project milestone review",
    date: "2026-03-12",
    time: "14:00",
    duration: 60,
  },
  {
    title: "Client Call",
    description: "Onboarding call with new client",
    date: "2026-03-15",
    time: "11:00",
    duration: 45,
  },
];

/** Adds the demo bookings to an empty database; otherwise does nothing. */
export async function seedBookings(db: NodePgDatabase) {
  if ((await db.$count(bookings)) === 0) {
    await db.insert(bookings).values(DEMO_BOOKINGS);
  }
}
