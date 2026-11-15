"use client";

import type { GeoJSONSource } from "maplibre-gl";

import { useEffect } from "react";

import { useMap } from "@/components/ui/map";
import { circle } from "@/features/map/components/bowl-layer";
import { firstSymbolLayerId, themeColor } from "@/features/nisar/components/nisar-layers";

const sourceId = "orbitalis-nisar-candidates";
const fillLayerId = `${sourceId}-fill`;
const ringLayerId = `${sourceId}-ring`;
const layerIds = [fillLayerId, ringLayerId];
const minimumRingRadiusM = 300;

export type CandidateRing = { center: [number, number]; radiusM: number };

function toFeatureCollection(candidates: CandidateRing[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: candidates.map((candidate) => ({
      type: "Feature",
      properties: {},
      geometry: circle(candidate.center, Math.max(candidate.radiusM, minimumRingRadiusM)),
    })),
  };
}

export function NisarCandidateLayer({ candidates }: { candidates: CandidateRing[] }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const data = toFeatureCollection(candidates);
    const source = map.getSource<GeoJSONSource>(sourceId);
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(sourceId, { type: "geojson", data });
    const beforeLayerId = firstSymbolLayerId(map);
    const color = themeColor("--foreground");
    map.addLayer(
      {
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: { "fill-color": color, "fill-opacity": 0.08 },
      },
      beforeLayerId,
    );
    map.addLayer(
      {
        id: ringLayerId,
        type: "line",
        source: sourceId,
        paint: { "line-color": color, "line-width": 2, "line-dasharray": [2, 2] },
      },
      beforeLayerId,
    );
  }, [map, isLoaded, candidates]);

  useEffect(() => {
    return () => {
      if (!map?.getStyle()) {
        return;
      }
      for (const layerId of layerIds) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
    };
  }, [map]);

  return null;
}
