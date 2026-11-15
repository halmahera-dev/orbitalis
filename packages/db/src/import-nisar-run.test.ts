import { SQL } from "bun";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { readFile } from "node:fs/promises";

import { importNisarRun, nisarRunFile, type NisarRunFile } from "./import-nisar-run";
import { migrationsFolder } from "./migrate";
import { bowl, bowlMeasurement, nisarCell, nisarRun } from "./schema/nisar";

const serverUrl = process.env.TEST_DATABASE_URL;
const testDatabase = "orbitalis_import_test";

function testDatabaseUrl() {
  const url = new URL(serverUrl!);
  url.pathname = `/${testDatabase}`;
  return url.toString();
}

const penjaringan = {
  id: "nisar-106805-6107",
  basis: "vertical",
  name: "Penjaringan",
  kecamatan: "Penjaringan",
  center: [106.80471, -6.10657] as [number, number],
  radiusM: 191,
  rateMmYr: 81.7,
  uncertaintyMmYr: 39.4,
  snr: 5.3,
  pixels: 18,
  pairs: 16,
  series: [
    { date: "2026-06-26", mm: 0, bandMm: 0 },
    { date: "2026-10-12", mm: -24.1, bandMm: 9.8 },
  ],
};

const cilincing = {
  ...penjaringan,
  id: "nisar-106944-6104",
  basis: "track10",
  name: "Cilincing",
  kecamatan: "Cilincing",
  center: [106.94412, -6.10398] as [number, number],
  snr: 3.1,
};

function makeRun(bowls: NisarRunFile["bowls"], periodEnd: string): NisarRunFile {
  return nisarRunFile.parse({
    product: "NISAR L2 GUNW provisional, unwrapped phase (HDF5)",
    script: "apps/jobs/stack_nisar_rate.py",
    tracks: [
      {
        track: 10,
        direction: "ascending",
        pairCount: 1,
        period: { start: "2026-06-26", end: periodEnd },
        pairs: ["NISAR_L2_PR_GUNW_SYNTHETIC_001"],
      },
    ],
    gridM: 80,
    noiseFloorMmYr: 15.3,
    detectionSnr: 2.5,
    minRateToUncertainty: 1.5,
    cellSizeM: 500,
    bowls,
    cells: Array.from({ length: 1200 }, (_, index) => ({
      id: `c${String(index).padStart(4, "0")}`,
      center: [106.7 + index * 0.0001, -6.15],
      sinkingMmYr: index % 3 === 0 ? null : 12.3,
      uncertaintyMmYr: index % 3 === 0 ? null : 8.1,
      coveredShare: 0.76,
      people: null,
    })),
  });
}

const firstRun = makeRun([penjaringan, cilincing], "2026-10-12");
const movedByHundredMetres = {
  ...penjaringan,
  id: "nisar-106805-6108",
  center: [106.80471, -6.10657 + 100 / 111_320] as [number, number],
  rateMmYr: 84.2,
};
const secondRun = makeRun([movedByHundredMetres], "2026-11-05");

async function rowCounts(db: ReturnType<typeof drizzle>) {
  const [runs, bowls, measurements, cells] = await Promise.all([
    db.$count(nisarRun),
    db.$count(bowl),
    db.$count(bowlMeasurement),
    db.$count(nisarCell),
  ]);
  return { runs, bowls, measurements, cells };
}

describe.skipIf(!serverUrl)("NISAR run import", () => {
  let admin: SQL;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    admin = new SQL(serverUrl!);
    await admin.unsafe(`DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)`);
    await admin.unsafe(`CREATE DATABASE ${testDatabase}`);
    db = drizzle(testDatabaseUrl());
    const pushedSchema = await readFile(`${migrationsFolder}/0000_baseline.sql`, "utf8");
    await db.$client.unsafe(pushedSchema.replaceAll("--> statement-breakpoint", ""));
    await db.$client`INSERT INTO inspection (bowl_id, status) VALUES ('muara-baru', 'lead')`;
    await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    await db?.$client.close();
    await admin?.unsafe(`DROP DATABASE IF EXISTS ${testDatabase} WITH (FORCE)`);
    await admin?.close();
  });

  test("migrations apply on top of push-created tables", async () => {
    const [applied] = await db.$client`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`;
    expect(applied.n).toBeGreaterThanOrEqual(2);
  });

  test("importing the same run twice changes nothing the second time", async () => {
    const first = await importNisarRun(db, firstRun);
    const afterFirst = await rowCounts(db);
    const second = await importNisarRun(db, firstRun);

    expect(first.newBowls).toBe(2);
    expect(second.runId).toBeNull();
    expect(afterFirst).toEqual({ runs: 1, bowls: 2, measurements: 2, cells: 1200 });
    expect(await rowCounts(db)).toEqual(afterFirst);

    const [series] = await db.$client`
      SELECT jsonb_typeof(series) AS kind, jsonb_array_length(series) AS points
      FROM bowl_measurement WHERE bowl_id = ${penjaringan.id}`;
    expect(series).toEqual({ kind: "array", points: 2 });
    const [tracks] = await db.$client`SELECT jsonb_typeof(tracks) AS kind FROM nisar_run`;
    expect(tracks.kind).toBe("array");
  });

  test("a peak that moved 100 m keeps its bowl id", async () => {
    const result = await importNisarRun(db, secondRun);

    expect(result.newBowls).toBe(0);
    expect(await db.$count(bowl)).toBe(2);
    expect(await db.$count(bowl, eq(bowl.id, movedByHundredMetres.id))).toBe(0);

    const measurements = await db
      .select({ rate: bowlMeasurement.rateMmYr })
      .from(bowlMeasurement)
      .where(eq(bowlMeasurement.bowlId, penjaringan.id))
      .orderBy(asc(bowlMeasurement.runId));
    expect(measurements).toEqual([{ rate: 81.7 }, { rate: 84.2 }]);
    expect(await db.$count(bowlMeasurement, eq(bowlMeasurement.bowlId, cilincing.id))).toBe(1);
  });

  test("a bowl id that belongs to a far bowl is refused and nothing is written", async () => {
    const before = await rowCounts(db);
    const farAwayWithTakenId = { ...cilincing, center: [106.6, -6.2] as [number, number] };
    const run = makeRun([farAwayWithTakenId], "2026-12-01");

    await expect(importNisarRun(db, run)).rejects.toThrow("is taken");
    expect(await rowCounts(db)).toEqual(before);
  });
});
