import { describe, expect, test } from "bun:test";

import { fastestMeasuredSinking, type MeasuredSinkingSite } from "./measured-sinking";

const bowl: MeasuredSinkingSite = {
  id: "muara-baru",
  name: "Muara Baru",
  rateMmYr: 34.1,
  kind: "bowl",
  seriesDownMm: [-1, -2],
};

const candidate: MeasuredSinkingSite = {
  id: "nisar-106805-6107",
  name: "Penjaringan",
  rateMmYr: 81.7,
  kind: "candidate",
  seriesDownMm: [],
};

describe("fastestMeasuredSinking", () => {
  test("returns null when there are no measured sites", () => {
    expect(fastestMeasuredSinking([])).toBeNull();
  });

  test("picks the highest measured rate, including NISAR candidates", () => {
    expect(fastestMeasuredSinking([bowl, candidate])).toEqual(candidate);
  });

  test("keeps a bowl when it is the only measured site", () => {
    expect(fastestMeasuredSinking([bowl])).toEqual(bowl);
  });
});
