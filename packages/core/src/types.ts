export const BOOKING_STATUSES = ["pending", "confirmed", "cancelled"] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface Booking {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  duration: number;
  status: BookingStatus;
}
