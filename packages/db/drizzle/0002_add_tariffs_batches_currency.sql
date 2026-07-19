CREATE TYPE "public"."currency" AS ENUM('UZS', 'USD');--> statement-breakpoint
CREATE TYPE "public"."transport" AS ENUM('avia', 'avto', 'train');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"transport" "transport" NOT NULL,
	"eta_date" date,
	"status" "track_status" DEFAULT 'CHINA_WAREHOUSE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tariffs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_per_kg_minor" bigint NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "currency" "currency" DEFAULT 'UZS' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "usd_rate_tiyin" bigint;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "tariff_id" uuid;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "price_usd_cents" bigint;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "usd_rate_used" bigint;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "price_manual" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "batches" ADD CONSTRAINT "batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracks" ADD CONSTRAINT "tracks_tariff_id_tariffs_id_fk" FOREIGN KEY ("tariff_id") REFERENCES "public"."tariffs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracks" ADD CONSTRAINT "tracks_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracks_batch_idx" ON "tracks" USING btree ("batch_id");--> statement-breakpoint
-- Backfill: every existing tenant gets one active default tariff seeded from its
-- old per-kg price (SPEC §5.9). Runs while tenants.price_per_kg_tiyin still
-- exists; migration 0003 drops that column right after.
INSERT INTO "tariffs" ("tenant_id", "name", "price_per_kg_minor", "is_default", "active", "sort")
SELECT "id", 'Asosiy', "price_per_kg_tiyin", true, true, 0 FROM "tenants";