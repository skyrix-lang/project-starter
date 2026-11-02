import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings } from "@/lib/db/schema";
import type { CreateBookingInput } from "@/lib/booking-schema";
import type { Booking, BookingStatus } from "@/types";

export async function getBookings(status?: BookingStatus): Promise<Booking[]> {
  return getDb()
    .select()
    .from(bookings)
    .where(status ? eq(bookings.status, status) : undefined)
    .orderBy(bookings.date, bookings.time);
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<Booking> {
  const [booking] = await getDb().insert(bookings).values(input).returning();
  return booking;
}

export async function updateBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<Booking | undefined> {
  const [booking] = await getDb()
    .update(bookings)
    .set({ status })
    .where(eq(bookings.id, id))
    .returning();
  return booking;
}
