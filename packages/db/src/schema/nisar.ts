import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const bowlSources = ["nisar", "manual"] as const;

export type NisarTrack = {
  track: number;
  direction: "ascending" | "descending";
  pairCount: number;
  period: { start: string; end: string };
  pairs: string[];
};

export type BowlSeriesPoint = { date: string; mm: number; bandMm: number };

export const nisarRun = pgTable(
  "nisar_run",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    contentKey: text("content_key").notNull().unique(),
    product: text("product").notNull(),
    script: text("script").notNull(),
    tracks: jsonb("tracks").$type<NisarTrack[]>().notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    gridM: integer("grid_m").notNull(),
    cellSizeM: integer("cell_size_m").notNull(),
    noiseFloorMmYr: doublePrecision("noise_floor_mm_yr").notNull(),
    detectionSnr: doublePrecision("detection_snr").notNull(),
    minRateToUncertainty: doublePrecision("min_rate_to_uncertainty").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("nisar_run_period_check", sql`${table.periodStart} <= ${table.periodEnd}`),
    check("nisar_run_grid_m_check", sql`${table.gridM} > 0 AND ${table.cellSizeM} > 0`),
  ],
);

export const bowl = pgTable(
  "bowl",
  {
    id: text("id").primaryKey(),
    source: text("source", { enum: bowlSources }).notNull(),
    name: text("name"),
    kecamatan: text("kecamatan"),
    lon: doublePrecision("lon").notNull(),
    lat: doublePrecision("lat").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check("bowl_source_check", sql`${table.source} IN ('nisar', 'manual')`),
    check(
      "bowl_nisar_place_check",
      sql`${table.source} = 'manual' OR (${table.name} IS NOT NULL AND ${table.kecamatan} IS NOT NULL)`,
    ),
    check("bowl_lon_check", sql`${table.lon} BETWEEN -180 AND 180`),
    check("bowl_lat_check", sql`${table.lat} BETWEEN -90 AND 90`),
  ],
);

export const bowlMeasurement = pgTable(
  "bowl_measurement",
  {
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => nisarRun.id, { onDelete: "cascade" }),
    bowlId: text("bowl_id")
      .notNull()
      .references(() => bowl.id, { onDelete: "restrict" }),
    basis: text("basis").notNull(),
    lon: doublePrecision("lon").notNull(),
    lat: doublePrecision("lat").notNull(),
    radiusM: integer("radius_m").notNull(),
    rateMmYr: doublePrecision("rate_mm_yr").notNull(),
    uncertaintyMmYr: doublePrecision("uncertainty_mm_yr").notNull(),
    snr: doublePrecision("snr").notNull(),
    pixels: integer("pixels").notNull(),
    pairs: integer("pairs").notNull(),
    series: jsonb("series").$type<BowlSeriesPoint[]>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.bowlId] }),
    index("bowl_measurement_bowl_id_idx").on(table.bowlId),
    check("bowl_measurement_basis_check", sql`${table.basis} ~ '^(vertical|track[0-9]+)$'`),
    check(
      "bowl_measurement_counts_check",
      sql`${table.radiusM} > 0 AND ${table.pixels} > 0 AND ${table.pairs} > 0`,
    ),
    check("bowl_measurement_uncertainty_check", sql`${table.uncertaintyMmYr} >= 0`),
  ],
);

export const nisarCell = pgTable(
  "nisar_cell",
  {
    runId: bigint("run_id", { mode: "number" })
      .notNull()
      .references(() => nisarRun.id, { onDelete: "cascade" }),
    cellId: text("cell_id").notNull(),
    lon: doublePrecision("lon").notNull(),
    lat: doublePrecision("lat").notNull(),
    sinkingMmYr: doublePrecision("sinking_mm_yr"),
    uncertaintyMmYr: doublePrecision("uncertainty_mm_yr"),
    coveredShare: doublePrecision("covered_share").notNull(),
    people: integer("people"),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.cellId] }),
    check("nisar_cell_covered_share_check", sql`${table.coveredShare} BETWEEN 0 AND 1`),
    check("nisar_cell_uncertainty_check", sql`${table.uncertaintyMmYr} >= 0`),
    check("nisar_cell_people_check", sql`${table.people} >= 0`),
  ],
);

export type NisarRun = typeof nisarRun.$inferSelect;
export type Bowl = typeof bowl.$inferSelect;
export type BowlSource = Bowl["source"];
export type BowlMeasurement = typeof bowlMeasurement.$inferSelect;
export type NisarCell = typeof nisarCell.$inferSelect;
