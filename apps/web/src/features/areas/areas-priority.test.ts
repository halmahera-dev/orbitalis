import { expect, test } from "bun:test";

import {
  defaultPriorityFilter,
  layerWeights,
  parsePriorityFilter,
  priorityFilterParams,
  rankAreas,
  rankLeads,
  type PriorityArea,
} from "./areas-priority";

function area(overrides: Partial<PriorityArea> & { id: string }): PriorityArea {
  return {
    kecamatan: "Penjaringan",
    center: [106.8, -6.12],
    sinkingMmYr: 20,
    populationPerKm2: 10_000,
    people: 2_500,
    pipedShare: 0.8,
    unservedPeople: 500,
    economy: "low",
    ...overrides,
  };
}

const fastSparse = area({
  id: "fast",
  sinkingMmYr: 90,
  populationPerKm2: 4_000,
  unservedPeople: 100,
});
const slowDense = area({
  id: "dense",
  sinkingMmYr: 20,
  populationPerKm2: 30_000,
  unservedPeople: 2_000,
  economy: "high",
});
const middle = area({ id: "middle", sinkingMmYr: 50, populationPerKm2: 15_000, economy: "medium" });
const areas = [fastSparse, slowDense, middle];

test("every layer's weights add up to one", () => {
  for (const weights of Object.values(layerWeights)) {
    const total = weights.sinking + weights.population + weights.economy;
    expect(total).toBeCloseTo(1, 10);
  }
});

test("rankAreas orders by the combined score of the layer weights", () => {
  const recharge = rankAreas(areas, "recharge", defaultPriorityFilter);
  expect(recharge.map((ranked) => ranked.area.id)).toEqual(["fast", "dense", "middle"]);
  expect(recharge[0].score).toBe(50);
  expect(recharge.map((ranked) => ranked.rank)).toEqual([1, 2, 3]);

  const pipe = rankAreas(areas, "pipe", defaultPriorityFilter);
  expect(pipe[0].area.id).toBe("dense");
});

test("rankAreas uses people without pipes as the population factor of the pipe layer", () => {
  const manyUnserved = area({ id: "unserved", populationPerKm2: 5_000, unservedPeople: 3_000 });
  const manyServed = area({ id: "served", populationPerKm2: 40_000, unservedPeople: 50 });
  const filter = { ...defaultPriorityFilter, rankBy: "population" as const };
  expect(rankAreas([manyServed, manyUnserved], "pipe", filter)[0].area.id).toBe("unserved");
  expect(rankAreas([manyServed, manyUnserved], "recharge", filter)[0].area.id).toBe("served");
});

test("rankAreas sorts by one factor when rankBy names it", () => {
  const byEconomy = rankAreas(areas, "recharge", { ...defaultPriorityFilter, rankBy: "economy" });
  expect(byEconomy.map((ranked) => ranked.area.id)).toEqual(["dense", "middle", "fast"]);
});

test("rankAreas keeps areas below a minimum, unranked and after the matches", () => {
  const filter = { ...defaultPriorityFilter, minSinkingMmYr: 40, minEconomy: "medium" as const };
  const ranked = rankAreas(areas, "recharge", filter);
  expect(ranked.map((item) => [item.area.id, item.matches, item.rank])).toEqual([
    ["middle", true, 1],
    ["fast", false, null],
    ["dense", false, null],
  ]);
});

test("rankLeads keeps the seed rank for combined and reads population from the nearest area", () => {
  const leads = [
    { id: "a", rank: 2, rateAfterBanMmYr: 80, center: [106.8, -6.12] as [number, number] },
    { id: "b", rank: 1, rateAfterBanMmYr: 30, center: [106.9, -6.12] as [number, number] },
  ];
  const nearAreas = [
    area({ id: "west", center: [106.8, -6.12], populationPerKm2: 5_000 }),
    area({ id: "east", center: [106.9, -6.12], populationPerKm2: 25_000 }),
  ];
  const combined = rankLeads(leads, nearAreas, defaultPriorityFilter);
  expect(combined.map((ranked) => ranked.lead.id)).toEqual(["b", "a"]);

  const bySinking = rankLeads(leads, nearAreas, { ...defaultPriorityFilter, rankBy: "sinking" });
  expect(bySinking.map((ranked) => ranked.lead.id)).toEqual(["a", "b"]);

  const dense = rankLeads(leads, nearAreas, {
    ...defaultPriorityFilter,
    minPopulationPerKm2: 10_000,
  });
  expect(dense.map((ranked) => [ranked.lead.id, ranked.matches])).toEqual([
    ["b", true],
    ["a", false],
  ]);
});

test("parsePriorityFilter reads valid params and ignores the rest", () => {
  const params = new URLSearchParams("rate=40&pop=12000&econ=high&rank=population");
  expect(parsePriorityFilter(params)).toEqual({
    minSinkingMmYr: 40,
    minPopulationPerKm2: 12_000,
    minEconomy: "high",
    rankBy: "population",
  });
  const broken = new URLSearchParams("rate=-5&pop=abc&econ=huge&rank=price");
  expect(parsePriorityFilter(broken)).toEqual(defaultPriorityFilter);
});

test("priorityFilterParams writes only values that differ from the default", () => {
  expect(priorityFilterParams(defaultPriorityFilter)).toEqual({
    rate: null,
    pop: null,
    econ: null,
    rank: null,
  });
  const filter = { ...defaultPriorityFilter, minSinkingMmYr: 30, rankBy: "economy" as const };
  expect(priorityFilterParams(filter)).toEqual({
    rate: "30",
    pop: null,
    econ: null,
    rank: "economy",
  });
  expect(parsePriorityFilter(new URLSearchParams("rate=30&rank=economy"))).toEqual(filter);
});
