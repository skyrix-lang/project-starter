import { CalendarDays, Plus } from "lucide-react";
import { useState } from "react";
import { throwUnexpected, useListBookings } from "@booking/api";
import type { BookingStatus } from "@booking/core";
import { Button, Card } from "@booking/ui";
import { BookingCard } from "./booking-card";
import { CreateBookingForm } from "./create-booking-form";
import { FilterBar } from "./filter-bar";

/** The bookings screen. The app's route passes the status from the URL. */
export function BookingsPage({ status }: { status?: BookingStatus }) {
  const [creating, setCreating] = useState(false);
  // Errors go to the route's error page, which offers to retry.
  const bookings = useListBookings(status ? { status } : undefined, {
    query: { throwOnError: throwUnexpected() },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track all your appointments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar active={status ?? "all"} />
          {!creating && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setCreating(true)}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              New booking
            </Button>
          )}
        </div>
      </div>

      {creating && <CreateBookingForm onDone={() => setCreating(false)} />}

      {bookings.isPending ? (
        <BookingsSkeleton />
      ) : bookings.data?.length === 0 ? (
        <Card className="text-center py-12">
          <CalendarDays
            aria-hidden="true"
            className="h-12 w-12 text-muted-foreground mx-auto"
          />
          <p className="mt-4 text-muted-foreground">No bookings found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.data?.map((booking) => (
            <BookingCard key={booking.id} booking={booking} />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
      role="status"
      aria-label="Loading bookings"
    >
      {[1, 2, 3].map((key) => (
        <div key={key} className="h-52 rounded-lg bg-muted animate-pulse" />
      ))}
    </div>
  );
}
