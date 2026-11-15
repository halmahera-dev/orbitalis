import "server-only";
import { z } from "zod";

import stackDocument from "./nisar-rates.json";

const stackSchema = z.object({
  synthetic: z.literal(false),
  product: z.string(),
  track: z.number(),
  direction: z.string(),
  pairCount: z.number().int().positive(),
  period: z.object({ start: z.string(), end: z.string() }),
  gridM: z.number().positive(),
  noiseFloorMmYr: z.number().nonnegative(),
  bowls: z.array(
    z.discriminatedUnion("measured", [
      z.object({
        id: z.string(),
        measured: z.literal(true),
        relativeRateMmYr: z.number(),
        uncertaintyMmYr: z.number().nonnegative(),
        pixels: z.number().int().positive(),
        pairs: z.number().int().positive(),
      }),
      z.object({ id: z.string(), measured: z.literal(false) }),
    ]),
  ),
  candidates: z.array(
    z.object({
      center: z.tuple([z.number(), z.number()]),
      radiusM: z.number().nonnegative(),
      relativeRateMmYr: z.number(),
      uncertaintyMmYr: z.number().nonnegative(),
      snr: z.number(),
    }),
  ),
});

export const nisarStack = stackSchema.parse(stackDocument);

export type NisarBowlRate = (typeof nisarStack.bowls)[number];

export function nisarRateForBowl(bowlId: string): NisarBowlRate {
  return nisarStack.bowls.find((bowl) => bowl.id === bowlId) ?? { id: bowlId, measured: false };
}
