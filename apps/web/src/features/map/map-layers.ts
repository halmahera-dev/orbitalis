export const mapLayers = ["leads", "sinking", "people", "farming", "radar"] as const;

export type MapLayer = (typeof mapLayers)[number];

export function parseMapLayer(value: string | null): MapLayer {
  return mapLayers.find((layer) => layer === value) ?? "leads";
}

export const triageSorts = ["signal", "rate", "people"] as const;

export type TriageSort = (typeof triageSorts)[number];

export function parseTriageSort(value: string | null): TriageSort {
  return triageSorts.find((sort) => sort === value) ?? "signal";
}
