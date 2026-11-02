import { z } from "zod";
import { BOOKING_STATUSES } from "@/types";

export const bookingIdSchema = z.uuid();

export const bookingStatusSchema = z.enum(BOOKING_STATUSES);

export const createBookingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).default(""),
  date: z.iso.date(),
  time: z.iso.time({ precision: -1 }), // HH:MM
  duration: z.int().positive().max(1440), // minutes
});

export const updateBookingSchema = z.object({
  status: bookingStatusSchema,
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
