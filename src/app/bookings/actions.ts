"use server";

import { revalidatePath } from "next/cache";
import { bookingIdSchema } from "@/lib/booking-schema";
import { updateBookingStatus } from "@/lib/bookings";
import { requireUser } from "@/lib/session";
import type { BookingStatus } from "@/types";

// Server Actions are public POST endpoints, so each one checks the session
// itself. A signed-out user is sent to sign in, then back to the list.
async function setStatus(id: string, status: BookingStatus) {
  const user = await requireUser("/bookings");
  // A booking that was removed, or isn't this user's, isn't a failure: nothing
  // changes, and it isn't on the refreshed list.
  await updateBookingStatus(user.id, bookingIdSchema.parse(id), status);
  revalidatePath("/bookings");
}

export async function confirmBooking(id: string) {
  await setStatus(id, "confirmed");
}

export async function cancelBooking(id: string) {
  await setStatus(id, "cancelled");
}
