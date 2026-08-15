ALTER TABLE "payments" ADD COLUMN "reversal_of" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_reversal_of_payments_id_fk" FOREIGN KEY ("reversal_of") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_reversal_of_uq" ON "payments" USING btree ("reversal_of") WHERE "payments"."reversal_of" IS NOT NULL;