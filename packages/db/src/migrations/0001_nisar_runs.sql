CREATE TABLE "bowl" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"name" text,
	"kecamatan" text,
	"lon" double precision NOT NULL,
	"lat" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bowl_source_check" CHECK ("bowl"."source" IN ('nisar', 'manual')),
	CONSTRAINT "bowl_nisar_place_check" CHECK ("bowl"."source" = 'manual' OR ("bowl"."name" IS NOT NULL AND "bowl"."kecamatan" IS NOT NULL)),
	CONSTRAINT "bowl_lon_check" CHECK ("bowl"."lon" BETWEEN -180 AND 180),
	CONSTRAINT "bowl_lat_check" CHECK ("bowl"."lat" BETWEEN -90 AND 90)
);
--> statement-breakpoint
CREATE TABLE "bowl_measurement" (
	"run_id" bigint NOT NULL,
	"bowl_id" text NOT NULL,
	"basis" text NOT NULL,
	"lon" double precision NOT NULL,
	"lat" double precision NOT NULL,
	"radius_m" integer NOT NULL,
	"rate_mm_yr" double precision NOT NULL,
	"uncertainty_mm_yr" double precision NOT NULL,
	"snr" double precision NOT NULL,
	"pixels" integer NOT NULL,
	"pairs" integer NOT NULL,
	"series" jsonb NOT NULL,
	CONSTRAINT "bowl_measurement_run_id_bowl_id_pk" PRIMARY KEY("run_id","bowl_id"),
	CONSTRAINT "bowl_measurement_basis_check" CHECK ("bowl_measurement"."basis" ~ '^(vertical|track[0-9]+)$'),
	CONSTRAINT "bowl_measurement_counts_check" CHECK ("bowl_measurement"."radius_m" > 0 AND "bowl_measurement"."pixels" > 0 AND "bowl_measurement"."pairs" > 0),
	CONSTRAINT "bowl_measurement_uncertainty_check" CHECK ("bowl_measurement"."uncertainty_mm_yr" >= 0)
);
--> statement-breakpoint
CREATE TABLE "nisar_cell" (
	"run_id" bigint NOT NULL,
	"cell_id" text NOT NULL,
	"lon" double precision NOT NULL,
	"lat" double precision NOT NULL,
	"sinking_mm_yr" double precision,
	"uncertainty_mm_yr" double precision,
	"covered_share" double precision NOT NULL,
	"people" integer,
	CONSTRAINT "nisar_cell_run_id_cell_id_pk" PRIMARY KEY("run_id","cell_id"),
	CONSTRAINT "nisar_cell_covered_share_check" CHECK ("nisar_cell"."covered_share" BETWEEN 0 AND 1),
	CONSTRAINT "nisar_cell_uncertainty_check" CHECK ("nisar_cell"."uncertainty_mm_yr" >= 0),
	CONSTRAINT "nisar_cell_people_check" CHECK ("nisar_cell"."people" >= 0)
);
--> statement-breakpoint
CREATE TABLE "nisar_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "nisar_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"content_key" text NOT NULL,
	"product" text NOT NULL,
	"script" text NOT NULL,
	"tracks" jsonb NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"grid_m" integer NOT NULL,
	"cell_size_m" integer NOT NULL,
	"noise_floor_mm_yr" double precision NOT NULL,
	"detection_snr" double precision NOT NULL,
	"min_rate_to_uncertainty" double precision NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nisar_run_content_key_unique" UNIQUE("content_key"),
	CONSTRAINT "nisar_run_period_check" CHECK ("nisar_run"."period_start" <= "nisar_run"."period_end"),
	CONSTRAINT "nisar_run_grid_m_check" CHECK ("nisar_run"."grid_m" > 0 AND "nisar_run"."cell_size_m" > 0)
);
--> statement-breakpoint
ALTER TABLE "bowl_measurement" ADD CONSTRAINT "bowl_measurement_run_id_nisar_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."nisar_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bowl_measurement" ADD CONSTRAINT "bowl_measurement_bowl_id_bowl_id_fk" FOREIGN KEY ("bowl_id") REFERENCES "public"."bowl"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nisar_cell" ADD CONSTRAINT "nisar_cell_run_id_nisar_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."nisar_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bowl_measurement_bowl_id_idx" ON "bowl_measurement" USING btree ("bowl_id");