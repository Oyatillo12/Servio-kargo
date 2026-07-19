ALTER TABLE "tenants" ADD COLUMN "code_prefix" text;--> statement-breakpoint
UPDATE "tenants" SET "code_prefix" = 'DK' WHERE "code_prefix" IS NULL;--> statement-breakpoint
ALTER TABLE "tenants" ALTER COLUMN "code_prefix" SET NOT NULL;