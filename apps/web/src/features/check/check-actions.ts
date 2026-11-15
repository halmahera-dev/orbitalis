"use server";

import * as z from "zod";

const nominatimUrl = "https://nominatim.openstreetmap.org/search";
const jakartaViewbox = "106.68,-6.08,106.98,-6.38";

const addressInput = z.string().trim().min(3).max(120);

const resultSchema = z.array(z.object({ lon: z.coerce.number(), lat: z.coerce.number() }));

type AddressResult = { ok: true; point: [number, number] } | { ok: false };

export async function findAddress(query: string): Promise<AddressResult> {
  const parsed = addressInput.safeParse(query);
  if (!parsed.success) {
    return { ok: false };
  }
  const params = new URLSearchParams({
    q: parsed.data,
    format: "jsonv2",
    limit: "1",
    countrycodes: "id",
    viewbox: jakartaViewbox,
    bounded: "1",
  });
  const response = await fetch(`${nominatimUrl}?${params}`, {
    headers: { "User-Agent": "orbitalis-web/0.1 (area check)" },
  });
  if (!response.ok) {
    return { ok: false };
  }
  const results = resultSchema.safeParse(await response.json());
  const first = results.success ? results.data[0] : undefined;
  return first ? { ok: true, point: [first.lon, first.lat] } : { ok: false };
}
