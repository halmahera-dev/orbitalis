import "server-only";
import { z } from "zod";

import { economyLevels, type PriorityArea } from "./areas-priority";
import seed from "./areas-seed.json";

const areaSeedSchema = z.object({
  synthetic: z.boolean(),
  cellSizeM: z.number().positive(),
  evidence: z.object({
    source: z.string(),
    script: z.string(),
    grid: z.string(),
    method: z.string(),
    period: z.string(),
  }),
  areas: z.array(
    z.object({
      id: z.string(),
      kecamatan: z.string(),
      center: z.tuple([z.number(), z.number()]),
      sinkingMmYr: z.number(),
      populationPerKm2: z.number().nonnegative(),
      people: z.number().nonnegative(),
      pipedShare: z.number().min(0).max(1),
      unservedPeople: z.number().nonnegative(),
      economy: z.enum(economyLevels),
    }),
  ),
});

export type AreaEvidence = z.infer<typeof areaSeedSchema>["evidence"];

export type PriorityAreaSet = {
  synthetic: boolean;
  cellSizeM: number;
  evidence: AreaEvidence;
  areas: PriorityArea[];
};

const areaSet: PriorityAreaSet = areaSeedSchema.parse(seed);

export function getPriorityAreas() {
  return areaSet;
}
