CREATE INDEX IF NOT EXISTS "admin_users_phone_idx" ON "admin_users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_tenant_customer_idx" ON "payments" USING btree ("tenant_id","customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payments_tenant_created_idx" ON "payments" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_events_track_idx" ON "track_events" USING btree ("track_id","created_at" DESC NULLS FIRST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_events_status_created_idx" ON "track_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracks_tenant_created_idx" ON "tracks" USING btree ("tenant_id","created_at" DESC NULLS FIRST) WHERE "tracks"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tracks_tenant_status_idx" ON "tracks" USING btree ("tenant_id","current_status") WHERE "tracks"."deleted_at" IS NULL;