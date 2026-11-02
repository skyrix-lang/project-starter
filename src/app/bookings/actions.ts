"use server";

import { revalidatePath } from "next/cache";
import { bookingIdSchema } from "@/lib/booking-schema";
import { updateBookingStatus } from "@/lib/bookings";
import type { BookingStatus } from "@/types";

// Server Actions are public POST endpoints: add an auth check here, as well as
// in the Route Handlers, before using this starter for real data.
async function setStatus(id: string, status: BookingStatus) {
  // A booking someone else removed isn't a failure: it just leaves the list.
  await updateBookingStatus(bookingIdSchema.parse(id), status);
  revalidatePath("/bookings");
}

export async function confirmBooking(id: string) {
  await setStatus(id, "confirmed");
}

export async function cancelBooking(id: string) {
  await setStatus(id, "cancelled");
}
