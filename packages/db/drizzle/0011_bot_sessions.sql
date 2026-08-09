CREATE TABLE IF NOT EXISTS "bot_sessions" (
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_sessions_tenant_id_key_pk" PRIMARY KEY("tenant_id","key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bot_sessions" ADD CONSTRAINT "bot_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
