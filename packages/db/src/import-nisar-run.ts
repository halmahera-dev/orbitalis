import { sql } from "drizzle-orm";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import * as z from "zod";

import { bowl, bowlMeasurement, nisarCell, nisarRun } from "./schema/nisar";

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const count = z.number().int().positive();

export const nisarRunFile = z.object({
  product: z.string().min(1),
  script: z.string().min(1),
  tracks: z
    .array(
      z.object({
        track: z.number().int(),
        direction: z.enum(["ascending", "descending"]),
        pairCount: z.number().int().nonnegative(),
        period: z.object({ start: z.iso.date(), end: z.iso.date() }),
        pairs: z.array(z.string().min(1)),
      }),
    )
    .min(1),
  gridM: count,
  noiseFloorMmYr: z.number(),
  detectionSnr: z.number(),
  minRateToUncertainty: z.number(),
  cellSizeM: count,
  bowls: z.array(
    z.object({
      id: z.string().startsWith("nisar-"),
      basis: z.string().regex(/^(vertical|track[0-9]+)$/),
      name: z.string().min(1),
      kecamatan: z.string().min(1),
      center: position,
      radiusM: count,
      rateMmYr: z.number(),
      uncertaintyMmYr: z.number().nonnegative(),
      snr: z.number(),
      pixels: count,
      pairs: count,
      series: z.array(z.object({ date: z.iso.date(), mm: z.number(), bandMm: z.number() })),
    }),
  ),
  cells: z.array(
    z.object({
      id: z.string().min(1),
      center: position,
      sinkingMmYr: z.number().nullable(),
      uncertaintyMmYr: z.number().nonnegative().nullable(),
      coveredShare: z.number().min(0).max(1),
      people: z.number().int().nonnegative().nullable(),
    }),
  ),
});

export type NisarRunFile = z.infer<typeof nisarRunFile>;
type DetectedBowl = NisarRunFile["bowls"][number];
type Position = [number, number];
type KnownBowl = { id: string; source: string; lon: number; lat: number };

const minMatchDistanceM = 250;
const cellBatchSize = 1000;

function distanceM([lon1, lat1]: Position, [lon2, lat2]: Position) {
  const metresPerDegree = 111_320;
  const meanLatRad = (((lat1 + lat2) / 2) * Math.PI) / 180;
  const eastM = (lon2 - lon1) * metresPerDegree * Math.cos(meanLatRad);
  const northM = (lat2 - lat1) * metresPerDegree;
  return Math.hypot(eastM, northM);
}

function findNearestNisarBowl(detected: DetectedBowl, known: KnownBowl[], claimed: Set<string>) {
  const maxDistanceM = Math.max(detected.radiusM, minMatchDistanceM);
  let nearest: KnownBowl | undefined;
  let nearestDistanceM = Infinity;
  for (const candidate of known) {
    if (candidate.source !== "nisar" || claimed.has(candidate.id)) {
      continue;
    }
    const candidateDistanceM = distanceM(detected.center, [candidate.lon, candidate.lat]);
    if (candidateDistanceM <= maxDistanceM && candidateDistanceM < nearestDistanceM) {
      nearest = candidate;
      nearestDistanceM = candidateDistanceM;
    }
  }
  return nearest;
}

function assignBowlIds(detectedBowls: DetectedBowl[], known: KnownBowl[]) {
  const knownIds = new Set(known.map((knownBowl) => knownBowl.id));
  const claimed = new Set<string>();
  const assignedIds = new Map<DetectedBowl, string>();
  const strongestFirst = [...detectedBowls].sort((a, b) => b.snr - a.snr);
  for (const detected of strongestFirst) {
    const match = findNearestNisarBowl(detected, known, claimed);
    const id = match?.id ?? detected.id;
    if (!match && knownIds.has(id)) {
      throw new Error(`Bowl id ${id} is taken by a bowl that does not match this detection.`);
    }
    claimed.add(id);
    assignedIds.set(detected, id);
  }
  return assignedIds;
}

// drizzle bun-sql double-encodes jsonb params, so send text and cast it in SQL.
function jsonb(value: unknown) {
  return sql`${JSON.stringify(value)}::text::jsonb`;
}

function contentKey(run: NisarRunFile) {
  return createHash("sha256").update(JSON.stringify(run)).digest("hex");
}

function runPeriod(run: NisarRunFile) {
  const starts = run.tracks.map((track) => track.period.start).sort();
  const ends = run.tracks.map((track) => track.period.end).sort();
  return { periodStart: starts[0]!, periodEnd: ends[ends.length - 1]! };
}

export async function importNisarRun(
  db: BunSQLDatabase<Record<string, unknown>>,
  run: NisarRunFile,
) {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(nisarRun)
      .values({
        contentKey: contentKey(run),
        product: run.product,
        script: run.script,
        tracks: jsonb(run.tracks),
        ...runPeriod(run),
        gridM: run.gridM,
        cellSizeM: run.cellSizeM,
        noiseFloorMmYr: run.noiseFloorMmYr,
        detectionSnr: run.detectionSnr,
        minRateToUncertainty: run.minRateToUncertainty,
      })
      .onConflictDoNothing({ target: nisarRun.contentKey })
      .returning({ id: nisarRun.id });
    if (!inserted) {
      return { runId: null, newBowls: 0, measurements: 0, cells: 0 };
    }

    const known = await tx
      .select({ id: bowl.id, source: bowl.source, lon: bowl.lon, lat: bowl.lat })
      .from(bowl);
    const knownIds = new Set(known.map((knownBowl) => knownBowl.id));
    const assignedIds = assignBowlIds(run.bowls, known);

    const newBowls = run.bowls
      .filter((detected) => !knownIds.has(assignedIds.get(detected)!))
      .map((detected) => ({
        id: assignedIds.get(detected)!,
        source: "nisar" as const,
        name: detected.name,
        kecamatan: detected.kecamatan,
        lon: detected.center[0],
        lat: detected.center[1],
      }));
    if (newBowls.length > 0) {
      await tx.insert(bowl).values(newBowls);
    }

    if (run.bowls.length > 0) {
      await tx.insert(bowlMeasurement).values(
        run.bowls.map((detected) => ({
          runId: inserted.id,
          bowlId: assignedIds.get(detected)!,
          basis: detected.basis,
          lon: detected.center[0],
          lat: detected.center[1],
          radiusM: detected.radiusM,
          rateMmYr: detected.rateMmYr,
          uncertaintyMmYr: detected.uncertaintyMmYr,
          snr: detected.snr,
          pixels: detected.pixels,
          pairs: detected.pairs,
          series: jsonb(detected.series),
        })),
      );
    }

    for (let start = 0; start < run.cells.length; start += cellBatchSize) {
      await tx.insert(nisarCell).values(
        run.cells.slice(start, start + cellBatchSize).map((cell) => ({
          runId: inserted.id,
          cellId: cell.id,
          lon: cell.center[0],
          lat: cell.center[1],
          sinkingMmYr: cell.sinkingMmYr,
          uncertaintyMmYr: cell.uncertaintyMmYr,
          coveredShare: cell.coveredShare,
          people: cell.people,
        })),
      );
    }

    return {
      runId: inserted.id,
      newBowls: newBowls.length,
      measurements: run.bowls.length,
      cells: run.cells.length,
    };
  });
}

if (import.meta.main) {
  const path = process.argv[2];
  const databaseUrl = process.env.DATABASE_URL;
  if (!path) {
    throw new Error("Usage: bun run import:nisar <path to nisar-run.json>");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const run = nisarRunFile.parse(JSON.parse(await readFile(path, "utf8")));
  const db = drizzle(databaseUrl);
  const result = await importNisarRun(db, run);
  await db.$client.close();
  if (result.runId === null) {
    console.log("This run is already imported. Nothing changed.");
  } else {
    console.log(
      `Imported run ${result.runId}: ${result.measurements} bowls (${result.newBowls} new), ${result.cells} cells.`,
    );
  }
}
