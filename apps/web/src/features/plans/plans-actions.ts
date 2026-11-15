"use server";

import { auth } from "@repo/auth";
import { db } from "@repo/db";
import { planItem } from "@repo/db/schema/plan";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as z from "zod";

import { getCells } from "@/features/bowls/bowls-queries";
import { planKinds, planStatuses } from "@/features/plans/plan-scores";

type ActionResult = { ok: true } | { ok: false; error: string };

const planInput = z.object({
  cellId: z.string().min(1).max(20),
  kind: z.enum(planKinds),
  status: z.enum(planStatuses).nullable(),
});

export async function setPlanStatus(input: z.input<typeof planInput>): Promise<ActionResult> {
  const parsed = planInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This plan change is not valid." };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "Sign in to change a plan." };
  }
  const { cellId, kind, status } = parsed.data;
  if (!(await getCells()).some((cell) => cell.id === cellId)) {
    return { ok: false, error: "This cell is not in the latest NISAR run." };
  }
  if (status === null) {
    await db.delete(planItem).where(and(eq(planItem.cellId, cellId), eq(planItem.kind, kind)));
  } else {
    const changes = { status, updatedBy: session.user.id, updatedAt: new Date() };
    await db
      .insert(planItem)
      .values({ cellId, kind, ...changes })
      .onConflictDoUpdate({ target: [planItem.cellId, planItem.kind], set: changes });
  }
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}
