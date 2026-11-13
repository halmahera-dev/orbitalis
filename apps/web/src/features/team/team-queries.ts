import "server-only";
import { db } from "@repo/db";
import { inspector } from "@repo/db/schema/inspector";
import { asc, eq } from "drizzle-orm";
import { cache } from "react";

import { getBowls } from "@/features/bowls/bowls-queries";
import { defaultInspectorNames } from "@/features/bowls/inspectors";
import { calendarDate, isVisitOverdue } from "@/features/bowls/visit";

export type TeamMember = {
  id: string;
  name: string;
  active: boolean;
  note: string | null;
  openVisits: number;
  overdueVisits: number;
  nextVisitDate: string | null;
};

export type TeamInsights = {
  activeCount: number;
  visitsThisWeek: number;
  overdueCount: number;
  heaviest: { name: string; openVisits: number } | null;
};

function weekBounds(today = calendarDate()) {
  const start = new Date(`${today}T00:00:00.000Z`);
  const day = start.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setUTCDate(start.getUTCDate() + mondayOffset);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

async function seedDefaultInspectors() {
  const now = new Date();
  await db.insert(inspector).values(
    defaultInspectorNames.map((name) => ({
      id: crypto.randomUUID(),
      name,
      active: true,
      note: null,
      createdAt: now,
      updatedAt: now,
    })),
  );
}

async function loadInspectors() {
  const rows = await db.select().from(inspector).orderBy(asc(inspector.name));
  if (rows.length > 0) {
    return rows;
  }
  await seedDefaultInspectors();
  return db.select().from(inspector).orderBy(asc(inspector.name));
}

export const getInspectors = cache(loadInspectors);

export const getActiveInspectorNames = cache(async () => {
  const rows = await getInspectors();
  return rows.filter((row) => row.active).map((row) => row.name);
});

export const getTeamMembers = cache(async (): Promise<TeamMember[]> => {
  const [rows, bowls] = await Promise.all([getInspectors(), getBowls()]);
  const today = calendarDate();

  return rows.map((row) => {
    const assigned = bowls.filter(
      (bowl) => bowl.status === "scheduled" && bowl.assignee === row.name,
    );
    const nextVisitDate =
      assigned
        .map((bowl) => bowl.visitDate)
        .filter((date): date is string => date !== null)
        .toSorted()[0] ?? null;

    return {
      id: row.id,
      name: row.name,
      active: row.active,
      note: row.note,
      openVisits: assigned.length,
      overdueVisits: assigned.filter((bowl) => isVisitOverdue(bowl, today)).length,
      nextVisitDate,
    };
  });
});

export const getTeamInsights = cache(async (): Promise<TeamInsights> => {
  const [members, bowls] = await Promise.all([getTeamMembers(), getBowls()]);
  const today = calendarDate();
  const { start, end } = weekBounds(today);
  const scheduled = bowls.filter((bowl) => bowl.status === "scheduled");
  const heaviest = members
    .filter((member) => member.active)
    .toSorted((a, b) => b.openVisits - a.openVisits)[0];

  return {
    activeCount: members.filter((member) => member.active).length,
    visitsThisWeek: scheduled.filter(
      (bowl) => bowl.visitDate !== null && bowl.visitDate >= start && bowl.visitDate <= end,
    ).length,
    overdueCount: scheduled.filter((bowl) => isVisitOverdue(bowl, today)).length,
    heaviest:
      heaviest && heaviest.openVisits > 0
        ? { name: heaviest.name, openVisits: heaviest.openVisits }
        : null,
  };
});

export async function getInspectorById(id: string) {
  const [row] = await db.select().from(inspector).where(eq(inspector.id, id)).limit(1);
  return row ?? null;
}
