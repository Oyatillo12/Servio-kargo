CREATE TYPE "public"."tenant_plan" AS ENUM('basic', 'premium');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan" "tenant_plan" DEFAULT 'basic' NOT NULL;