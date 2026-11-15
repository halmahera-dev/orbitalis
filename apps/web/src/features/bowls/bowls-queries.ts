import "server-only";
import { db } from "@repo/db";
import { farmingSite, type FarmingSite } from "@repo/db/schema/farming";
import { inspection } from "@repo/db/schema/inspection";
import {
  bowl as bowlTable,
  bowlMeasurement,
  nisarCell,
  nisarRun,
  type BowlSeriesPoint,
  type NisarTrack,
} from "@repo/db/schema/nisar";
import { and, desc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { cache } from "react";

export type BowlStatus = (typeof inspection.$inferSelect)["status"];
export type InspectionOutcome = NonNullable<(typeof inspection.$inferSelect)["outcome"]>;
export type { BowlSeriesPoint };

export type NisarRunSummary = {
  id: number;
  product: string;
  script: string;
  tracks: NisarTrack[];
  periodStart: string;
  periodEnd: string;
  gridM: number;
  cellSizeM: number;
  noiseFloorMmYr: number;
  detectionSnr: number;
  minRateToUncertainty: number;
};

export type Cell = {
  id: string;
  center: [number, number];
  sinkingMmYr: number | null;
  uncertaintyMmYr: number | null;
  coveredShare: number;
  people: number | null;
};

export type InspectionFields = {
  status: BowlStatus;
  assignee: string | null;
  visitDate: string | null;
  outcome: InspectionOutcome | null;
  note: string | null;
  updatedAt: string | null;
};

export type Bowl = InspectionFields & {
  id: string;
  source: "nisar" | "manual" | "farming";
  site: Pick<FarmingSite, "kind" | "areaM2"> | null;
  name: string;
  kecamatan: string;
  center: [number, number];
  radiusM: number;
  rateMmYr: number | null;
  uncertaintyMmYr: number | null;
  snr: number | null;
  isOneTrack: boolean;
  pairs: number | null;
  series: BowlSeriesPoint[];
  cellId: string | null;
  peoplePerKm2: number | null;
  rank: number;
};

export const getLatestRun = cache(async (): Promise<NisarRunSummary | null> => {
  await connection();
  const [run] = await db
    .select()
    .from(nisarRun)
    .orderBy(desc(nisarRun.periodEnd), desc(nisarRun.id))
    .limit(1);
  return run ?? null;
});

export const getCells = cache(async (): Promise<Cell[]> => {
  const run = await getLatestRun();
  if (!run) {
    return [];
  }
  const rows = await db.select().from(nisarCell).where(eq(nisarCell.runId, run.id));
  return rows.map((row) => ({
    id: row.cellId,
    center: [row.lon, row.lat],
    sinkingMmYr: row.sinkingMmYr,
    uncertaintyMmYr: row.uncertaintyMmYr,
    coveredShare: row.coveredShare,
    people: row.people,
  }));
});

export function cellAreaKm2(cellSizeM: number) {
  return (cellSizeM / 1000) ** 2;
}

function metersBetween([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const metersPerDegree = 111_320;
  const east = (lon2 - lon1) * metersPerDegree * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  const north = (lat2 - lat1) * metersPerDegree;
  return { east, north };
}

export function cellAt(point: [number, number], cells: Cell[], cellSizeM: number) {
  const half = cellSizeM / 2;
  return (
    cells.find((cell) => {
      const { east, north } = metersBetween(cell.center, point);
      return Math.abs(east) <= half && Math.abs(north) <= half;
    }) ?? null
  );
}

function inspectionFields(row: typeof inspection.$inferSelect | null): InspectionFields {
  return {
    status: row?.status ?? "lead",
    assignee: row?.assignee ?? null,
    visitDate: row?.visitDate ?? null,
    outcome: row?.outcome ?? null,
    note: row?.note ?? null,
    updatedAt: row?.updatedAt?.toISOString() ?? null,
  };
}

function triageOrder(a: Bowl, b: Bowl) {
  return (b.snr ?? -Infinity) - (a.snr ?? -Infinity) || (b.rateMmYr ?? 0) - (a.rateMmYr ?? 0);
}

function withRanks(bowls: Bowl[]) {
  return bowls.toSorted(triageOrder).map((bowl, index) => ({ ...bowl, rank: index + 1 }));
}

function siteRadiusM(areaM2: number) {
  return Math.round(Math.sqrt(areaM2 / Math.PI));
}

async function loadBowls(): Promise<Bowl[]> {
  const run = await getLatestRun();
  if (!run) {
    return [];
  }
  const [rows, cells] = await Promise.all([
    db
      .select({ bowl: bowlTable, measurement: bowlMeasurement, inspection, site: farmingSite })
      .from(bowlTable)
      .leftJoin(
        bowlMeasurement,
        and(eq(bowlMeasurement.bowlId, bowlTable.id), eq(bowlMeasurement.runId, run.id)),
      )
      .leftJoin(inspection, eq(inspection.bowlId, bowlTable.id))
      .leftJoin(farmingSite, eq(farmingSite.bowlId, bowlTable.id)),
    getCells(),
  ]);
  const areaKm2 = cellAreaKm2(run.cellSizeM);

  const bowls = rows
    .filter((row) => row.measurement !== null || row.bowl.source !== "nisar")
    .map((row): Bowl => {
      const measurement = row.measurement;
      const site = row.site ? { kind: row.site.kind, areaM2: row.site.areaM2 } : null;
      const center: [number, number] = measurement
        ? [measurement.lon, measurement.lat]
        : [row.bowl.lon, row.bowl.lat];
      const cell = cellAt(center, cells, run.cellSizeM);
      return {
        ...inspectionFields(row.inspection),
        id: row.bowl.id,
        source: row.bowl.source,
        site,
        name: row.bowl.name ?? cell?.id ?? row.bowl.id,
        kecamatan: row.bowl.kecamatan ?? "",
        center,
        radiusM: measurement?.radiusM ?? (site ? siteRadiusM(site.areaM2) : run.cellSizeM / 2),
        rateMmYr: measurement?.rateMmYr ?? cell?.sinkingMmYr ?? null,
        uncertaintyMmYr: measurement?.uncertaintyMmYr ?? cell?.uncertaintyMmYr ?? null,
        snr: measurement?.snr ?? null,
        isOneTrack: measurement !== null && measurement.basis !== "vertical",
        pairs: measurement?.pairs ?? null,
        series: measurement?.series ?? [],
        cellId: cell?.id ?? null,
        peoplePerKm2: cell?.people == null ? null : Math.round(cell.people / areaKm2),
        rank: 0,
      };
    });
  const leads = bowls.filter((bowl) => bowl.source !== "farming");
  const sites = bowls.filter((bowl) => bowl.source === "farming");
  return [...withRanks(leads), ...withRanks(sites)];
}

export const getBowls = cache(loadBowls);

export async function getBowl(bowlId: string) {
  const bowls = await getBowls();
  return bowls.find((bowl) => bowl.id === bowlId) ?? null;
}
