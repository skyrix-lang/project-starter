import {
  customType,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
// A relative import: drizzle-kit doesn't resolve the "@/" alias.
import { BOOKING_STATUSES } from "@/types";

export const bookingStatus = pgEnum("booking_status", BOOKING_STATUSES);

// Postgres returns "09:00:00"; the app works with "09:00".
const timeOfDay = customType<{ data: string; driverData: string }>({
  dataType: () => "time(0)",
  fromDriver: (value) => value.slice(0, 5),
});

export const bookings = pgTable("bookings", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text().notNull().default(""),
  date: date({ mode: "string" }).notNull(),
  time: timeOfDay().notNull(),
  duration: integer().notNull(),
  status: bookingStatus().notNull().default("pending"),
});
