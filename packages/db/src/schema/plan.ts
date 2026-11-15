import { sql } from "drizzle-orm";
import { check, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const planKinds = ["recharge", "pipe"] as const;
export const planStatuses = ["proposed", "surveyed", "approved", "built"] as const;

// cell_id is the grid id from the NISAR run (c<row>-<column>), stable while the window stays the same.
export const planItem = pgTable(
  "plan_item",
  {
    cellId: text("cell_id").notNull(),
    kind: text("kind", { enum: planKinds }).notNull(),
    status: text("status", { enum: planStatuses }).notNull(),
    note: text("note"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cellId, table.kind] }),
    check("plan_item_kind_check", sql`${table.kind} IN ('recharge', 'pipe')`),
    check(
      "plan_item_status_check",
      sql`${table.status} IN ('proposed', 'surveyed', 'approved', 'built')`,
    ),
  ],
);

export type PlanItem = typeof planItem.$inferSelect;
