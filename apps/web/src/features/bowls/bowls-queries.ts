import "server-only";
import { db } from "@repo/db";
import { inspection } from "@repo/db/schema/inspection";
import { connection } from "next/server";
import { cache } from "react";

import { nisarCandidates, type NisarCandidate } from "@/features/nisar/nisar-queries";

import seed from "./bowls-seed.json";

export type BowlStatus = (typeof inspection.$inferSelect)["status"];
export type InspectionOutcome = NonNullable<(typeof inspection.$inferSelect)["outcome"]>;

type SeedBowl = (typeof seed.bowls)[number];

export type BowlSeries = SeedBowl["series"];

export type PublicBowl = Omit<SeedBowl, "series" | "center"> & {
  center: [number, number];
};

export type Bowl = PublicBowl & {
  status: BowlStatus;
  assignee: string | null;
  visitDate: string | null;
  outcome: InspectionOutcome | null;
  note: string | null;
  updatedAt: string | null;
};

export const banDate = seed.banDate;
export const highTideM = seed.highTideM;

function toPublicBowl({ series: _series, center, ...bowl }: SeedBowl): PublicBowl {
  return { ...bowl, center: [center[0], center[1]] };
}

export function getPublicBowls() {
  return seed.bowls.map(toPublicBowl);
}

export function getBowlSeries(bowlId: string) {
  return seed.bowls.find((bowl) => bowl.id === bowlId)?.series ?? null;
}

export function getBowlSeriesById() {
  return Object.fromEntries(seed.bowls.map((bowl) => [bowl.id, bowl.series]));
}

type InspectionRow = typeof inspection.$inferSelect;

export type InspectionFields = Pick<
  Bowl,
  "status" | "assignee" | "visitDate" | "outcome" | "note" | "updatedAt"
>;

export type NisarLead = NisarCandidate & InspectionFields;

const getInspectionRowsById = cache(async () => {
  await connection();
  const rows = await db.select().from(inspection);
  return new Map(rows.map((row) => [row.bowlId, row]));
});

function inspectionFields(row: InspectionRow | undefined): InspectionFields {
  return {
    status: row?.status ?? "lead",
    assignee: row?.assignee ?? null,
    visitDate: row?.visitDate ?? null,
    outcome: row?.outcome ?? null,
    note: row?.note ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

async function loadBowls(): Promise<Bowl[]> {
  const rowById = await getInspectionRowsById();
  return getPublicBowls().map((bowl) => ({ ...bowl, ...inspectionFields(rowById.get(bowl.id)) }));
}

export const getBowls = cache(loadBowls);

export async function getNisarLeads(): Promise<NisarLead[]> {
  const rowById = await getInspectionRowsById();
  return nisarCandidates().map((candidate) => ({
    ...candidate,
    ...inspectionFields(rowById.get(candidate.id)),
  }));
}

export async function getBowl(bowlId: string) {
  const bowls = await getBowls();
  return bowls.find((bowl) => bowl.id === bowlId) ?? null;
}
