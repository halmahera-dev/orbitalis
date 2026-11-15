import { priorityLayers, type PriorityLayer } from "@/features/areas/areas-priority";

export const mapLayers = ["leads", ...priorityLayers, "radar"] as const;

export type MapLayer = (typeof mapLayers)[number];

export function parseMapLayer(value: string | null): MapLayer {
  return mapLayers.find((layer) => layer === value) ?? "leads";
}

export function isPriorityLayer(layer: MapLayer): layer is PriorityLayer {
  return priorityLayers.some((priorityLayer) => priorityLayer === layer);
}
