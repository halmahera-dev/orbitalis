import "server-only";
import { z } from "zod";

import stackDocument from "./nisar-rates.json";

const trackSchema = z.object({
  track: z.number().int(),
  direction: z.enum(["ascending", "descending"]),
  pairCount: z.number().int().positive(),
  period: z.object({ start: z.iso.date(), end: z.iso.date() }),
  pairs: z.array(z.string()).nonempty(),
});

const seriesPointSchema = z.object({
  date: z.iso.date(),
  mm: z.number(),
  bandMm: z.number().nonnegative(),
});

const candidateSchema = z.object({
  id: z.string().startsWith("nisar-"),
  basis: z.enum(["vertical", "track10"]),
  name: z.string(),
  kecamatan: z.string(),
  center: z.tuple([z.number(), z.number()]),
  radiusM: z.number().nonnegative(),
  rateMmYr: z.number(),
  uncertaintyMmYr: z.number().nonnegative(),
  snr: z.number(),
});

const stackSchema = z.object({
  synthetic: z.literal(false),
  product: z.string(),
  tracks: z.tuple([trackSchema, trackSchema]),
  gridM: z.number().positive(),
  noiseFloorMmYr: z.number().nonnegative(),
  detectionSnr: z.number().positive(),
  script: z.string(),
  bowls: z.array(
    z.discriminatedUnion("measured", [
      z.object({
        id: z.string(),
        measured: z.literal(true),
        verticalRateMmYr: z.number(),
        verticalUncertaintyMmYr: z.number().nonnegative(),
        eastRateMmYr: z.number(),
        losRateMmYr: z.record(z.string(), z.number()),
        pixels: z.number().int().positive(),
        pairs: z.number().int().positive(),
        series: z.array(seriesPointSchema),
      }),
      z.object({ id: z.string(), measured: z.literal(false) }),
    ]),
  ),
  candidates: z.array(candidateSchema),
});

export const nisarStack = stackSchema.parse(stackDocument);

export type NisarBowlRate = (typeof nisarStack.bowls)[number];
export type NisarCandidate = z.infer<typeof candidateSchema>;
export type NisarSeriesPoint = z.infer<typeof seriesPointSchema>;

export function nisarRateForBowl(bowlId: string): NisarBowlRate {
  return nisarStack.bowls.find((bowl) => bowl.id === bowlId) ?? { id: bowlId, measured: false };
}

export function nisarCandidates(): NisarCandidate[] {
  return nisarStack.candidates;
}

export function nisarCandidate(id: string): NisarCandidate | null {
  return nisarStack.candidates.find((candidate) => candidate.id === id) ?? null;
}
