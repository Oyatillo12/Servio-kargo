ALTER TABLE "customers" ADD COLUMN "phone_normalized" text;--> statement-breakpoint
-- Backfill the comparison key for rows written before the column existed.
-- This expression MUST stay identical to `normalizePhone` in
-- packages/shared/src/phone.ts (SPEC 7.12): digits only, then the last 9.
-- `right(s, 9)` returns the whole string when it is shorter than 9, matching
-- the JS branch; NULLIF maps "no digits at all" back to NULL.
UPDATE "customers"
SET "phone_normalized" = NULLIF(right(regexp_replace("phone", '\D', '', 'g'), 9), '')
WHERE "phone" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_tenant_phone_idx" ON "customers" USING btree ("tenant_id","phone_normalized");
