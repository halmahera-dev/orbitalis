export const economyLevels = ["low", "medium", "high"] as const;
export const rankByOptions = ["combined", "sinking", "population", "economy"] as const;
export const priorityLayers = ["recharge", "pipe", "farming"] as const;

export type Economy = (typeof economyLevels)[number];
export type RankBy = (typeof rankByOptions)[number];
export type PriorityLayer = (typeof priorityLayers)[number];
export type Factor = Exclude<RankBy, "combined">;

export type PriorityArea = {
  id: string;
  kecamatan: string;
  center: [number, number];
  sinkingMmYr: number;
  populationPerKm2: number;
  people: number;
  pipedShare: number;
  unservedPeople: number;
  economy: Economy;
};

export type PriorityFilter = {
  minSinkingMmYr: number;
  minPopulationPerKm2: number;
  minEconomy: Economy;
  rankBy: RankBy;
};

export type RankedArea = {
  area: PriorityArea;
  score: number;
  factors: Record<Factor, number>;
  matches: boolean;
  rank: number | null;
};

type Lead = { id: string; rank: number; rateAfterBanMmYr: number; center: [number, number] };

export type RankedLead<T extends Lead> = {
  lead: T;
  area: PriorityArea | null;
  matches: boolean;
  rank: number | null;
};

export const layerWeights: Record<PriorityLayer, Record<Factor, number>> = {
  recharge: { sinking: 0.5, population: 0.3, economy: 0.2 },
  pipe: { sinking: 0.3, population: 0.6, economy: 0.1 },
  farming: { sinking: 0.3, population: 0.2, economy: 0.5 },
};

export const defaultPriorityFilter: PriorityFilter = {
  minSinkingMmYr: 0,
  minPopulationPerKm2: 0,
  minEconomy: "low",
  rankBy: "combined",
};

export function economyLevel(economy: Economy) {
  return economyLevels.indexOf(economy);
}

export function populationFactorValue(area: PriorityArea, layer: PriorityLayer) {
  return layer === "pipe" ? area.unservedPeople : area.populationPerKm2;
}

function matchesFilter(
  values: { sinkingMmYr: number; populationPerKm2: number; economy: Economy },
  filter: PriorityFilter,
) {
  return (
    values.sinkingMmYr >= filter.minSinkingMmYr &&
    values.populationPerKm2 >= filter.minPopulationPerKm2 &&
    economyLevel(values.economy) >= economyLevel(filter.minEconomy)
  );
}

function normalizer(values: number[]) {
  const min = Math.min(...values);
  const span = Math.max(...values) - min;
  return (value: number) => (span === 0 ? 0 : (value - min) / span);
}

function assignRanks<T extends { matches: boolean; rank: number | null }>(sorted: T[]) {
  let nextRank = 1;
  return sorted.map((item) => (item.matches ? { ...item, rank: nextRank++ } : item));
}

function matchesFirst(a: { matches: boolean }, b: { matches: boolean }) {
  return Number(b.matches) - Number(a.matches);
}

export function rankAreas(
  areas: PriorityArea[],
  layer: PriorityLayer,
  filter: PriorityFilter,
): RankedArea[] {
  const weights = layerWeights[layer];
  const sinkingShare = normalizer(areas.map((area) => area.sinkingMmYr));
  const populationShare = normalizer(areas.map((area) => populationFactorValue(area, layer)));
  const economyShare = (economy: Economy) => economyLevel(economy) / (economyLevels.length - 1);

  const scored = areas.map((area): RankedArea => {
    const factors = {
      sinking: sinkingShare(area.sinkingMmYr),
      population: populationShare(populationFactorValue(area, layer)),
      economy: economyShare(area.economy),
    };
    const combined =
      weights.sinking * factors.sinking +
      weights.population * factors.population +
      weights.economy * factors.economy;
    return {
      area,
      score: Math.round(combined * 100),
      factors,
      matches: matchesFilter(area, filter),
      rank: null,
    };
  });

  function sortValue(item: RankedArea) {
    return filter.rankBy === "combined" ? item.score : item.factors[filter.rankBy];
  }

  const sorted = scored.toSorted(
    (a, b) =>
      matchesFirst(a, b) ||
      sortValue(b) - sortValue(a) ||
      b.area.sinkingMmYr - a.area.sinkingMmYr ||
      a.area.id.localeCompare(b.area.id),
  );
  return assignRanks(sorted);
}

function squaredDistance(a: [number, number], b: [number, number]) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
}

export function nearestArea(center: [number, number], areas: PriorityArea[]) {
  let nearest: PriorityArea | null = null;
  for (const area of areas) {
    if (
      !nearest ||
      squaredDistance(center, area.center) < squaredDistance(center, nearest.center)
    ) {
      nearest = area;
    }
  }
  return nearest;
}

type Candidate = { id: string; rateMmYr: number; center: [number, number] };

export type RankedCandidate<T extends Candidate> = {
  candidate: T;
  matches: boolean;
  rank: number | null;
};

export function candidateLabel(basis: "vertical" | "track10") {
  return basis === "track10" ? "oneTrack" : "confirmed";
}

export function rankCandidates<T extends Candidate>(
  candidates: T[],
  areas: PriorityArea[],
  filter: PriorityFilter,
): RankedCandidate<T>[] {
  const scored = candidates.map((candidate): RankedCandidate<T> => {
    const area = nearestArea(candidate.center, areas);
    return {
      candidate,
      matches: matchesFilter(
        {
          sinkingMmYr: candidate.rateMmYr,
          populationPerKm2: area?.populationPerKm2 ?? 0,
          economy: area?.economy ?? "low",
        },
        filter,
      ),
      rank: null,
    };
  });
  const sorted = scored.toSorted(
    (a, b) => matchesFirst(a, b) || b.candidate.rateMmYr - a.candidate.rateMmYr,
  );
  return assignRanks(sorted);
}

export function rankLeads<T extends Lead>(
  leads: T[],
  areas: PriorityArea[],
  filter: PriorityFilter,
): RankedLead<T>[] {
  const withAreas = leads.map((lead): RankedLead<T> => {
    const area = nearestArea(lead.center, areas);
    return {
      lead,
      area,
      matches: matchesFilter(
        {
          sinkingMmYr: lead.rateAfterBanMmYr,
          populationPerKm2: area?.populationPerKm2 ?? 0,
          economy: area?.economy ?? "low",
        },
        filter,
      ),
      rank: null,
    };
  });

  function sortValue(item: RankedLead<T>) {
    switch (filter.rankBy) {
      case "combined":
        return -item.lead.rank;
      case "sinking":
        return item.lead.rateAfterBanMmYr;
      case "population":
        return item.area?.populationPerKm2 ?? 0;
      case "economy":
        return economyLevel(item.area?.economy ?? "low");
    }
  }

  const sorted = withAreas.toSorted(
    (a, b) => matchesFirst(a, b) || sortValue(b) - sortValue(a) || a.lead.rank - b.lead.rank,
  );
  return assignRanks(sorted);
}

function readNonNegative(value: string | null, fallback: number) {
  const number = Number(value);
  return value !== null && value !== "" && Number.isFinite(number) && number >= 0
    ? number
    : fallback;
}

function readOption<T extends string>(options: readonly T[], value: string | null, fallback: T) {
  return options.find((option) => option === value) ?? fallback;
}

export function parsePriorityFilter(params: Pick<URLSearchParams, "get">): PriorityFilter {
  return {
    minSinkingMmYr: readNonNegative(params.get("rate"), defaultPriorityFilter.minSinkingMmYr),
    minPopulationPerKm2: readNonNegative(
      params.get("pop"),
      defaultPriorityFilter.minPopulationPerKm2,
    ),
    minEconomy: readOption(economyLevels, params.get("econ"), defaultPriorityFilter.minEconomy),
    rankBy: readOption(rankByOptions, params.get("rank"), defaultPriorityFilter.rankBy),
  };
}

function unlessDefault<T>(value: T, fallback: T) {
  return value === fallback ? null : String(value);
}

export function priorityFilterParams(filter: PriorityFilter) {
  return {
    rate: unlessDefault(filter.minSinkingMmYr, defaultPriorityFilter.minSinkingMmYr),
    pop: unlessDefault(filter.minPopulationPerKm2, defaultPriorityFilter.minPopulationPerKm2),
    econ: unlessDefault(filter.minEconomy, defaultPriorityFilter.minEconomy),
    rank: unlessDefault(filter.rankBy, defaultPriorityFilter.rankBy),
  };
}
