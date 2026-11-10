import type { BookingStatus } from "@booking/core";

export const statusTone = {
  pending: "warning",
  confirmed: "success",
  cancelled: "danger",
} as const satisfies Record<BookingStatus, string>;
