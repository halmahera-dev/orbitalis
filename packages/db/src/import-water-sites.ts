import { sql } from "drizzle-orm";
import { drizzle, type BunSQLDatabase } from "drizzle-orm/bun-sql";
import { readFile } from "node:fs/promises";
import * as z from "zod";

import { farmingSite, farmingSiteKinds } from "./schema/farming";
import { bowl } from "./schema/nisar";

export const waterSitesFile = z.object({
  source: z.string().min(1),
  script: z.string().min(1),
  sites: z.array(
    z.object({
      osmId: z.string().regex(/^(way|relation)\/\d+$/),
      name: z.string().min(1),
      kind: z.enum(farmingSiteKinds),
      center: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
      areaM2: z.number().int().positive(),
    }),
  ),
});

export type WaterSitesFile = z.infer<typeof waterSitesFile>;

export function siteBowlId(osmId: string) {
  return `site-${osmId.replace("/", "-")}`;
}

export async function importWaterSites(
  db: BunSQLDatabase<Record<string, unknown>>,
  file: WaterSitesFile,
) {
  if (file.sites.length === 0) {
    return 0;
  }
  await db.transaction(async (tx) => {
    await tx
      .insert(bowl)
      .values(
        file.sites.map((site) => ({
          id: siteBowlId(site.osmId),
          source: "farming" as const,
          name: site.name,
          lon: site.center[0],
          lat: site.center[1],
        })),
      )
      .onConflictDoUpdate({
        target: bowl.id,
        set: { name: sql`excluded.name`, lon: sql`excluded.lon`, lat: sql`excluded.lat` },
      });
    await tx
      .insert(farmingSite)
      .values(
        file.sites.map((site) => ({
          bowlId: siteBowlId(site.osmId),
          osmId: site.osmId,
          kind: site.kind,
          areaM2: site.areaM2,
        })),
      )
      .onConflictDoUpdate({
        target: farmingSite.bowlId,
        set: { kind: sql`excluded.kind`, areaM2: sql`excluded.area_m2` },
      });
  });
  return file.sites.length;
}

if (import.meta.main) {
  const path = process.argv[2];
  const databaseUrl = process.env.DATABASE_URL;
  if (!path) {
    throw new Error("Usage: bun run import:sites <path to water-sites.json>");
  }
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const file = waterSitesFile.parse(JSON.parse(await readFile(path, "utf8")));
  const db = drizzle(databaseUrl);
  const count = await importWaterSites(db, file);
  await db.$client.close();
  console.log(`Imported ${count} water farming sites.`);
}
