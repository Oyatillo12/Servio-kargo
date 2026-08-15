ALTER TABLE "tariffs" ADD COLUMN "volumetric_coef" integer DEFAULT 167 NOT NULL;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "length_cm" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "width_cm" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "height_cm" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "volumetric_grams" integer;