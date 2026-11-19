import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  getListBookingsQueryKey,
  throwUnexpected,
  useUpdateBooking,
  type Booking,
} from "@booking/api";
import type { BookingStatus } from "@booking/core";
import { Badge, Button, Card, toast } from "@booking/ui";
import { NAMESPACE } from "./messages";
import { statusTone } from "./status";

/** "2026-03-14" as the reader writes dates, in their language: "Mar 14, 2026". */
function formatDate(date: string, language: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(
    new Date(year!, month! - 1, day),
  );
}

export function BookingCard({ booking }: { booking: Booking }) {
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation(NAMESPACE);
  const update = useUpdateBooking({
    mutation: {
      onSuccess: (_, { data }) => {
        toast({
          title: t(
            data.status === "confirmed" ? "card.confirmed" : "card.cancelled",
          ),
        });
      },
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
        <Badge tone={statusTone[booking.status]}>
          {t(`status.${booking.status}`)}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{booking.description}</p>
      <div className="text-sm text-muted-foreground space-y-1">
        <p>
          {t("card.when", {
            date: formatDate(booking.date, i18n.language),
            time: booking.time,
          })}
        </p>
        <p>{t("card.duration", { count: booking.duration })}</p>
      </div>
      <div className="flex items-center gap-2 mt-auto pt-3 border-t">
        {booking.status !== "confirmed" && (
          <Button
            size="sm"
            disabled={update.isPending}
            onClick={() => setStatus("confirmed")}
          >
            {t("card.confirm")}
          </Button>
        )}
        {booking.status !== "cancelled" && (
          <Button
            variant="ghost"
            size="sm"
            disabled={update.isPending}
            onClick={() => setStatus("cancelled")}
          >
            {t("card.cancel")}
          </Button>
        )}
      </div>
    </Card>
  );
}
