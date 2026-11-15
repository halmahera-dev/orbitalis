import "server-only";
import { db } from "@repo/db";
import { planItem } from "@repo/db/schema/plan";
import { connection } from "next/server";
import { cache } from "react";

import type { PlanEntry } from "@/features/plans/plan-scores";

export const getPlanEntries = cache(async (): Promise<PlanEntry[]> => {
  await connection();
  const rows = await db.select().from(planItem);
  return rows.map((row) => ({ cellId: row.cellId, kind: row.kind, status: row.status }));
});
