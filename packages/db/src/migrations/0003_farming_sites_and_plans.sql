CREATE TABLE "farming_site" (
	"bowl_id" text PRIMARY KEY NOT NULL,
	"osm_id" text NOT NULL,
	"kind" text NOT NULL,
	"area_m2" integer NOT NULL,
	CONSTRAINT "farming_site_osm_id_unique" UNIQUE("osm_id"),
	CONSTRAINT "farming_site_kind_check" CHECK ("farming_site"."kind" IN ('reservoir', 'embung', 'situ', 'retention', 'lake')),
	CONSTRAINT "farming_site_area_check" CHECK ("farming_site"."area_m2" > 0)
);
--> statement-breakpoint
CREATE TABLE "plan_item" (
	"cell_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"note" text,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_item_cell_id_kind_pk" PRIMARY KEY("cell_id","kind"),
	CONSTRAINT "plan_item_kind_check" CHECK ("plan_item"."kind" IN ('recharge', 'pipe')),
	CONSTRAINT "plan_item_status_check" CHECK ("plan_item"."status" IN ('proposed', 'surveyed', 'approved', 'built'))
);
--> statement-breakpoint
ALTER TABLE "bowl" DROP CONSTRAINT "bowl_source_check";--> statement-breakpoint
ALTER TABLE "bowl" DROP CONSTRAINT "bowl_nisar_place_check";--> statement-breakpoint
ALTER TABLE "farming_site" ADD CONSTRAINT "farming_site_bowl_id_bowl_id_fk" FOREIGN KEY ("bowl_id") REFERENCES "public"."bowl"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_item" ADD CONSTRAINT "plan_item_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bowl" ADD CONSTRAINT "bowl_source_check" CHECK ("bowl"."source" IN ('nisar', 'manual', 'farming'));--> statement-breakpoint
ALTER TABLE "bowl" ADD CONSTRAINT "bowl_nisar_place_check" CHECK ("bowl"."source" <> 'nisar' OR ("bowl"."name" IS NOT NULL AND "bowl"."kecamatan" IS NOT NULL));