CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
-- Bookings now belong to a user. Existing rows have no owner, and before this
-- migration only demo data existed, so they are removed: run `yarn db:seed
-- <email>` to add the demo bookings again for your account.
DELETE FROM "bookings";--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "rate_limits_reset_at_idx" ON "rate_limits" USING btree ("reset_at");--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_user_id_date_time_idx" ON "bookings" USING btree ("user_id","date","time");