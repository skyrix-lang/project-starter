import { z } from "zod";
import { BOOKING_STATUSES } from "./types";

// Shared by the BFF (validation and its OpenAPI spec) and the web app (forms).
// `.meta({ id })` names the schema in the OpenAPI document, so the generated
// client gets a named type.

export const bookingIdSchema = z.uuid();

export const bookingStatusSchema = z
  .enum(BOOKING_STATUSES)
  .meta({ id: "BookingStatus" });

export const createBookingSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).default(""),
    date: z.iso.date(),
    time: z.iso.time({ precision: -1 }), // HH:MM
    duration: z.int().positive().max(1440), // minutes
  })
  .meta({ id: "CreateBooking" });

export const updateBookingSchema = z
  .object({ status: bookingStatusSchema })
  .meta({ id: "UpdateBooking" });

export const bookingSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string(),
    date: z.iso.date(),
    time: z.string().meta({ example: "09:30" }),
    duration: z.int(),
    status: bookingStatusSchema,
  })
  .meta({ id: "Booking" });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
