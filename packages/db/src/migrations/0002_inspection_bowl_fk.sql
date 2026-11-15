SET LOCAL lock_timeout = '5s';--> statement-breakpoint
SET LOCAL statement_timeout = '60s';--> statement-breakpoint
DELETE FROM "inspection" WHERE NOT EXISTS (SELECT 1 FROM "bowl" WHERE "bowl"."id" = "inspection"."bowl_id");--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_bowl_id_bowl_id_fk" FOREIGN KEY ("bowl_id") REFERENCES "public"."bowl"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_status_check" CHECK ("inspection"."status" IN ('lead', 'scheduled', 'inspected', 'closed', 'dismissed'));--> statement-breakpoint
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_outcome_check" CHECK ("inspection"."outcome" IN ('pump_found', 'no_pump', 'natural'));
