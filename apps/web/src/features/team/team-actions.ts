"use server";

import { auth } from "@repo/auth";
import { db } from "@repo/db";
import { inspection } from "@repo/db/schema/inspection";
import { inspector } from "@repo/db/schema/inspector";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import * as z from "zod";

import { getInspectorById } from "@/features/team/team-queries";

type ActionResult = { ok: true } | { ok: false; error: string };

const nameInput = z.string().trim().min(1).max(80);
const noteInput = z.string().trim().max(500);

const createInput = z.object({
  name: nameInput,
  note: noteInput.optional(),
});

const updateInput = z.object({
  id: z.string().uuid(),
  name: nameInput,
  note: noteInput.optional(),
});

const idInput = z.object({
  id: z.string().uuid(),
});

async function requireSession(): Promise<ActionResult | { ok: true; userId: string }> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { ok: false, error: "Sign in to change the team." };
  }
  return { ok: true, userId: session.user.id };
}

function revalidateTeam() {
  revalidatePath("/[locale]", "layout");
}

export async function createInspector(input: z.input<typeof createInput>): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) {
    return session;
  }
  const parsed = createInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter an inspector name." };
  }
  const name = parsed.data.name;
  const [existing] = await db
    .select({ id: inspector.id })
    .from(inspector)
    .where(eq(inspector.name, name))
    .limit(1);
  if (existing) {
    return { ok: false, error: "That name is already on the team." };
  }
  const now = new Date();
  await db.insert(inspector).values({
    id: crypto.randomUUID(),
    name,
    active: true,
    note: parsed.data.note || null,
    createdAt: now,
    updatedAt: now,
  });
  revalidateTeam();
  return { ok: true };
}

export async function updateInspector(input: z.input<typeof updateInput>): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) {
    return session;
  }
  const parsed = updateInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter an inspector name." };
  }
  const current = await getInspectorById(parsed.data.id);
  if (!current) {
    return { ok: false, error: "That inspector is not on the team." };
  }
  const name = parsed.data.name;
  const [clash] = await db
    .select({ id: inspector.id })
    .from(inspector)
    .where(and(eq(inspector.name, name), ne(inspector.id, parsed.data.id)))
    .limit(1);
  if (clash) {
    return { ok: false, error: "That name is already on the team." };
  }
  await db
    .update(inspector)
    .set({
      name,
      note: parsed.data.note || null,
      updatedAt: new Date(),
    })
    .where(eq(inspector.id, parsed.data.id));
  if (current.name !== name) {
    await db
      .update(inspection)
      .set({ assignee: name, updatedAt: new Date() })
      .where(and(eq(inspection.assignee, current.name), eq(inspection.status, "scheduled")));
  }
  revalidateTeam();
  return { ok: true };
}

export async function archiveInspector(input: z.input<typeof idInput>): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) {
    return session;
  }
  const parsed = idInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That inspector is not on the team." };
  }
  await db
    .update(inspector)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(inspector.id, parsed.data.id));
  revalidateTeam();
  return { ok: true };
}

export async function restoreInspector(input: z.input<typeof idInput>): Promise<ActionResult> {
  const session = await requireSession();
  if (!session.ok) {
    return session;
  }
  const parsed = idInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "That inspector is not on the team." };
  }
  await db
    .update(inspector)
    .set({ active: true, updatedAt: new Date() })
    .where(eq(inspector.id, parsed.data.id));
  revalidateTeam();
  return { ok: true };
}
