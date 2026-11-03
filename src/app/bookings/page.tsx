import type { Metadata } from "next";
import { CalendarDaysIcon } from "@heroicons/react/24/outline";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { bookingStatusSchema } from "@/lib/booking-schema";
import { getBookings } from "@/lib/bookings";
import { requireUser } from "@/lib/session";
import type { BookingStatus } from "@/types";
import { confirmBooking, cancelBooking } from "./actions";
import { FilterBar } from "./filter-bar";

export const metadata: Metadata = {
  title: "Bookings",
  robots: { index: false },
};

const statusColors: Record<BookingStatus, string> = {
  pending: "bg-warning/10 text-amber-700",
  confirmed: "bg-success/10 text-green-700",
  cancelled: "bg-error/10 text-red-700",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const { status } = await searchParams;
  const parsed = bookingStatusSchema.safeParse(status);
  const user = await requireUser(
    parsed.data ? `/bookings?status=${parsed.data}` : "/bookings",
  );
  const bookings = await getBookings(user.id, parsed.data);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Bookings</h1>
          <p className="text-sm text-surface-500 mt-1">
            Manage and track all your appointments.
          </p>
        </div>
        <FilterBar active={parsed.data ?? "all"} />
      </div>

      {bookings.length === 0 ? (
        <Card className="text-center py-12">
          <CalendarDaysIcon className="h-12 w-12 text-surface-300 mx-auto" />
          <p className="mt-4 text-surface-500">No bookings found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((booking) => (
            <Card
              key={booking.id}
              data-testid="booking-card"
              className="flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-semibold text-surface-900">
                  {booking.title}
                </h2>
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusColors[booking.status]}`}
                >
                  {booking.status}
                </span>
              </div>
              <p className="text-sm text-surface-500">{booking.description}</p>
              <div className="text-sm text-surface-400 space-y-1">
                <p>
                  {booking.date} at {booking.time}
                </p>
                <p>{booking.duration} min</p>
              </div>
              <div className="flex items-center gap-2 mt-auto pt-3 border-t border-surface-100">
                {booking.status !== "confirmed" && (
                  <form action={confirmBooking.bind(null, booking.id)}>
                    <SubmitButton size="sm">Confirm</SubmitButton>
                  </form>
                )}
                {booking.status !== "cancelled" && (
                  <form action={cancelBooking.bind(null, booking.id)}>
                    <SubmitButton variant="ghost" size="sm">
                      Cancel
                    </SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
