import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings } from "@/lib/db/schema";
import type { CreateBookingInput } from "@/lib/booking-schema";
import type { Booking, BookingStatus } from "@/types";

// Every function takes the signed-in user's id and only reads or changes that
// user's bookings. Another user's booking behaves as if it didn't exist.

// What the pages and the API see: not the owner or the timestamps.
const publicColumns = {
  id: bookings.id,
  title: bookings.title,
  description: bookings.description,
  date: bookings.date,
  time: bookings.time,
  duration: bookings.duration,
  status: bookings.status,
};

export async function getBookings(
  userId: string,
  status?: BookingStatus,
): Promise<Booking[]> {
  return getDb()
    .select(publicColumns)
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        status ? eq(bookings.status, status) : undefined,
      ),
    )
    .orderBy(bookings.date, bookings.time);
}

export async function createBooking(
  userId: string,
  input: CreateBookingInput,
): Promise<Booking> {
  const [booking] = await getDb()
    .insert(bookings)
    .values({ ...input, userId })
    .returning(publicColumns);
  return booking;
}

/** Returns undefined when the booking doesn't exist or isn't the user's. */
export async function updateBookingStatus(
  userId: string,
  id: string,
  status: BookingStatus,
): Promise<Booking | undefined> {
  const [booking] = await getDb()
    .update(bookings)
    .set({ status })
    .where(and(eq(bookings.id, id), eq(bookings.userId, userId)))
    .returning(publicColumns);
  return booking;
}
