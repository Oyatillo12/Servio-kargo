CREATE TYPE "public"."broadcast_status" AS ENUM('queued', 'cancelled');--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "recipient_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "status" "broadcast_status" DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "cancelled_by" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_cancelled_by_admin_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- Backfill: rows that predate recipient_count were all sent before the hold
-- window existed, so "delivered" is the only recipient figure we ever had.
-- Leaving them at 0 would render as "12 / 0" in the history (SPEC 5.8) and
-- make a finished broadcast look stoppable.
UPDATE "broadcasts" SET "recipient_count" = "sent_count" WHERE "recipient_count" = 0;
