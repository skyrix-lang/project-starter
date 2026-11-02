import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  bookingStatusSchema,
  createBookingSchema,
} from "@/lib/booking-schema";
import { createBooking, getBookings } from "@/lib/bookings";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = bookingStatusSchema
    .optional()
    .safeParse(searchParams.get("status") ?? undefined);

  if (!status.success) {
    return NextResponse.json(
      { error: "Invalid status", issues: status.error.issues },
      { status: 400 },
    );
  }

  return NextResponse.json(await getBookings(status.data));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = createBookingSchema.safeParse(body);

  if (!input.success) {
    return NextResponse.json(
      { error: "Invalid booking", issues: input.error.issues },
      { status: 400 },
    );
  }

  const booking = await createBooking(input.data);
  revalidatePath("/bookings");
  return NextResponse.json(booking, { status: 201 });
}
