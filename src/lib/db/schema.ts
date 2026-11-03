import {
  customType,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";
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

// Auth.js tables, used by its Drizzle adapter (src/lib/auth.ts). The adapter
// reads them by property name, so the SQL names can follow this project's style.

export const users = pgTable("users", {
  id: uuid().primaryKey().defaultRandom(),
  name: text(),
  email: text().unique(),
  emailVerified: timestamp("email_verified", {
    mode: "date",
    withTimezone: true,
  }),
  image: text(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text().$type<AdapterAccountType>().notNull(),
    provider: text().notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: text(),
    scope: text(),
    id_token: text(),
    session_state: text(),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp({ mode: "date", withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text().notNull(),
    token: text().notNull(),
    expires: timestamp({ mode: "date", withTimezone: true }).notNull(),
  },
  (verificationToken) => [
    primaryKey({
      columns: [verificationToken.identifier, verificationToken.token],
    }),
  ],
);
