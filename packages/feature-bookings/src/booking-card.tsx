import { useQueryClient } from "@tanstack/react-query";
import {
  getListBookingsQueryKey,
  throwUnexpected,
  useUpdateBooking,
  type Booking,
} from "@booking/api";
import type { BookingStatus } from "@booking/core";
import { Badge, Button, Card } from "@booking/ui";
import { statusTone } from "./status";

export function BookingCard({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient();
  const update = useUpdateBooking({
    mutation: {
      // A booking removed meanwhile (404) isn't a failure: the refreshed list
      // just doesn't have it. Anything else goes to the error page.
      throwOnError: throwUnexpected(404),
      onSettled: () =>
        queryClient.invalidateQueries({ queryKey: getListBookingsQueryKey() }),
    },
  });
  const setStatus = (status: BookingStatus) =>
    update.mutate({ id: booking.id, data: { status } });

  return (
    <Card data-testid="booking-card" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{booking.title}</h2>
        <Badge tone={statusTone[booking.status]}>{booking.status}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">{booking.description}</p>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          {booking.date} at {booking.time}
        </p>
        <p>{booking.duration} min</p>
      </div>
      <div className="flex items-center gap-2 mt-auto pt-3 border-t">
        {booking.status !== "confirmed" && (
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() => setStatus("confirmed")}
          >
            Confirm
          </Button>
        )}
        {booking.status !== "cancelled" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={update.isPending}
            onClick={() => setStatus("cancelled")}
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
