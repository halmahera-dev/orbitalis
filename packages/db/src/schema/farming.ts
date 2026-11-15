import { sql } from "drizzle-orm";
import { check, integer, pgTable, text } from "drizzle-orm/pg-core";

import { bowl } from "./nisar";

export const farmingSiteKinds = ["reservoir", "embung", "situ", "retention", "lake"] as const;

export const farmingSite = pgTable(
  "farming_site",
  {
    bowlId: text("bowl_id")
      .primaryKey()
      .references(() => bowl.id, { onDelete: "cascade" }),
    osmId: text("osm_id").notNull().unique(),
    kind: text("kind", { enum: farmingSiteKinds }).notNull(),
    areaM2: integer("area_m2").notNull(),
  },
  (table) => [
    check(
      "farming_site_kind_check",
      sql`${table.kind} IN ('reservoir', 'embung', 'situ', 'retention', 'lake')`,
    ),
    check("farming_site_area_check", sql`${table.areaM2} > 0`),
  ],
);

export type FarmingSite = typeof farmingSite.$inferSelect;
