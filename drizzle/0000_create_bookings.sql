CREATE TYPE "public"."booking_status" AS ENUM('pending', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"date" date NOT NULL,
	"time" time(0) NOT NULL,
	"duration" integer NOT NULL,
	"status" "booking_status" DEFAULT 'pending' NOT NULL
);
