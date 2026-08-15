CREATE TYPE "public"."photo_kind" AS ENUM('intake', 'damage', 'handover');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "track_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"kind" "photo_kind" DEFAULT 'intake' NOT NULL,
	"path" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "track_photos" ADD CONSTRAINT "track_photos_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "track_photos" ADD CONSTRAINT "track_photos_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_photos_track_idx" ON "track_photos" USING btree ("track_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
-- SPEC 7.14: carry every single-photo-era shot over as an `intake` photo, at
-- the path where its file already lives, BEFORE the column is dropped.
INSERT INTO "track_photos" ("tenant_id", "track_id", "kind", "path", "created_at")
SELECT "tenant_id", "id", 'intake', "photo_path", "created_at"
FROM "tracks"
WHERE "photo_path" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" DROP COLUMN IF EXISTS "photo_path";