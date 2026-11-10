CREATE TABLE "user_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"id_token" text,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification_tokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "accounts" CASCADE;--> statement-breakpoint
DROP TABLE "sessions" CASCADE;--> statement-breakpoint
DROP TABLE "verification_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidc_issuer" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidc_subject" text;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_oidc_issuer_subject_idx" ON "users" USING btree ("oidc_issuer","oidc_subject");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "email_verified";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "image";