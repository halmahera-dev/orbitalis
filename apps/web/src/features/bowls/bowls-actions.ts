"use server";

import { auth } from "@repo/auth";
import { db } from "@repo/db";
import { bowlStatuses, inspection, inspectionOutcomes } from "@repo/db/schema/inspection";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as z from "zod";

import { nisarCandidates } from "@/features/nisar/nisar-queries";
import { getActiveInspectorNames } from "@/features/team/team-queries";

import seed from "./bowls-seed.json";

type ActionResult = { ok: true } | { ok: false; error: string };

const leadIds = [
  ...seed.bowls.map((bowl) => bowl.id),
  ...nisarCandidates().map((candidate) => candidate.id),
] as [string, ...string[]];

const bowlId = z.enum(leadIds);

const moveInput = z.object({
  bowlId,
  status: z.enum(bowlStatuses).exclude(["scheduled", "closed"]),
});

const scheduleInput = z.object({
  bowlId,
  assignee: z.string().trim().min(1),
  visitDate: z.iso.date(),
});

const outcomeInput = z.object({
  bowlId,
  outcome: z.enum(inspectionOutcomes),
  note: z.string().trim().max(1000),
});

type InspectionValues = Omit<typeof inspection.$inferInsert, "bowlId" | "updatedBy" | "updatedAt">;

async function saveInspection(bowl: string, values: InspectionValues): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "Sign in to change a bowl." };
  }
  const changes = { ...values, updatedBy: session.user.id, updatedAt: new Date() };
  await db
    .insert(inspection)
    .values({ bowlId: bowl, ...changes })
    .onConflictDoUpdate({ target: inspection.bowlId, set: changes });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

// Moving back to lead or to dismissed clears the visit, so old data does not linger.
export async function moveBowl(input: z.input<typeof moveInput>) {
  const parsed = moveInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "This move is not valid." } satisfies ActionResult;
  }
  const { status } = parsed.data;
  const clearsVisit = status === "lead" || status === "dismissed";
  return saveInspection(parsed.data.bowlId, {
    status,
    ...(clearsVisit ? { assignee: null, visitDate: null, outcome: null, note: null } : {}),
  });
}

export async function scheduleVisit(input: z.input<typeof scheduleInput>) {
  const parsed = scheduleInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter an inspector and a date." } satisfies ActionResult;
  }
  const { assignee, visitDate } = parsed.data;
  const activeNames = await getActiveInspectorNames();
  if (!activeNames.includes(assignee)) {
    return { ok: false, error: "Pick an inspector from the list." } satisfies ActionResult;
  }
  return saveInspection(parsed.data.bowlId, {
    status: "scheduled",
    assignee,
    visitDate,
    outcome: null,
  });
}

export async function recordOutcome(input: z.input<typeof outcomeInput>) {
  const parsed = outcomeInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Choose an outcome." } satisfies ActionResult;
  }
  const { outcome, note } = parsed.data;
  return saveInspection(parsed.data.bowlId, {
    status: "closed",
    outcome,
    note: note || null,
  });
}
