import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { bookingIdSchema, updateBookingSchema } from "@/lib/booking-schema";
import { updateBookingStatus } from "@/lib/bookings";
import { getUser } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await getUser())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const input = updateBookingSchema.safeParse(body);

  if (!input.success) {
    return NextResponse.json(
      { error: "Invalid status", issues: input.error.issues },
      { status: 400 },
    );
  }

  const bookingId = bookingIdSchema.safeParse(id);
  const booking = bookingId.success
    ? await updateBookingStatus(bookingId.data, input.data.status)
    : undefined;
  if (!booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  revalidatePath("/bookings");
  return NextResponse.json(booking);
}
