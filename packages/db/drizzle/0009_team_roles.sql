-- Enum widened by REPLACING the type, not by `ALTER TYPE … ADD VALUE`.
--
-- Postgres refuses to use an enum value added by the current transaction
-- ("55P04: New enum values must be committed before they can be used"), and
-- drizzle runs EVERY pending migration inside ONE transaction — so splitting the
-- ADD VALUE into its own migration file does not help, which is how this was
-- first (wrongly) attempted. A type CREATEd in the transaction has no such
-- restriction, so the rename/create/cast/drop dance below is the one form that
-- works here. `staff` is carried across so pre-existing rows stay castable; it
-- is rewritten to `manager` at the end of this file and never issued again.
ALTER TYPE "public"."admin_role" RENAME TO "admin_role_old";--> statement-breakpoint
CREATE TYPE "public"."admin_role" AS ENUM('owner', 'manager', 'warehouse', 'staff');--> statement-breakpoint
-- The default has to go before the cast; it is re-set below, to 'manager'.
ALTER TABLE "admin_users" ALTER COLUMN "role" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "role" TYPE "public"."admin_role" USING "role"::text::"public"."admin_role";--> statement-breakpoint
DROP TYPE "public"."admin_role_old";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "phone" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ALTER COLUMN "role" SET DEFAULT 'manager';--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "tg_user_id" bigint;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "full_name" text;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "session_epoch" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "broadcasts" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_by" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "admin_invites" ADD CONSTRAINT "admin_invites_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_invites_code_idx" ON "admin_invites" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_invites_admin_uq" ON "admin_invites" USING btree ("admin_user_id") WHERE "admin_invites"."accepted_at" IS NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "broadcasts" ADD CONSTRAINT "broadcasts_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_admin_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_tenant_phone_uq" ON "admin_users" USING btree ("tenant_id","phone") WHERE "admin_users"."phone" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_users_tenant_tg_user_uq" ON "admin_users" USING btree ("tenant_id","tg_user_id") WHERE "admin_users"."tg_user_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_users_tenant_idx" ON "admin_users" USING btree ("tenant_id");
--> statement-breakpoint
-- Backfill 1: the legacy two-role world had exactly one non-owner value, and
-- everyone holding it was doing office work. 'staff' is retired, not reused.
UPDATE "admin_users" SET "role" = 'manager' WHERE "role" = 'staff';--> statement-breakpoint
-- Backfill 2: `tenants.settings.staff_tg_ids` was the bot's private list of
-- Telegram ids allowed to weigh parcels — an identity the panel could not see,
-- name, or revoke. Each id becomes a real employee row, so it shows up on the
-- team screen and the audit trail can say who weighed what. They arrive with no
-- phone and no password: bot-only until an owner invites them to the panel.
INSERT INTO "admin_users" ("tenant_id", "tg_user_id", "role", "active")
SELECT DISTINCT
  t."id",
  v."value"::bigint,
  -- Cast explicitly: inside a SELECT list a bare literal resolves to `text`, and
  -- INSERT … SELECT does not coerce that to the enum the way VALUES would.
  'warehouse'::"public"."admin_role",
  true
FROM "tenants" t
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(t."settings" -> 'staff_tg_ids') = 'array'
    THEN t."settings" -> 'staff_tg_ids'
    ELSE '[]'::jsonb
  END
) AS v("value")
-- Telegram ids are digits and fit in a bigint; anything else in that array was
-- never usable by the bot anyway, so skipping it loses nothing. The length bound
-- stops a junk value from aborting the whole migration on an integer overflow.
WHERE v."value" ~ '^[0-9]{1,18}$'
ON CONFLICT DO NOTHING;
