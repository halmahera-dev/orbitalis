"use client";

import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";

import { useEffect, useEffectEvent } from "react";

import { useMap } from "@/components/ui/map";
import { circle } from "@/features/map/components/bowl-layer";
import { firstSymbolLayerId, themeColor } from "@/features/nisar/components/nisar-layers";

const sourceId = "orbitalis-nisar-candidates";
const fillLayerId = `${sourceId}-fill`;
const ringLayerId = `${sourceId}-ring`;
const layerIds = [fillLayerId, ringLayerId];
const minimumRingRadiusM = 300;

export type CandidateRing = { id: string; center: [number, number]; radiusM: number };

const isSelected: ExpressionSpecification = ["==", ["get", "selected"], 1];

function toFeatureCollection(
  candidates: CandidateRing[],
  selectedId: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: candidates.map((candidate) => ({
      type: "Feature",
      properties: { id: candidate.id, selected: candidate.id === selectedId ? 1 : 0 },
      geometry: circle(candidate.center, Math.max(candidate.radiusM, minimumRingRadiusM)),
    })),
  };
}

export function NisarCandidateLayer({
  candidates,
  selectedId,
  onSelect,
}: {
  candidates: CandidateRing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { map, isLoaded } = useMap();
  const select = useEffectEvent(onSelect);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const data = toFeatureCollection(candidates, selectedId);
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
        paint: {
          "fill-color": color,
          "fill-opacity": ["case", isSelected, 0.16, 0.08] as ExpressionSpecification,
        },
      },
      beforeLayerId,
    );
    map.addLayer(
      {
        id: ringLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": color,
          "line-width": ["case", isSelected, 3, 2] as ExpressionSpecification,
          "line-dasharray": [2, 2],
        },
      },
      beforeLayerId,
    );
  }, [map, isLoaded, candidates, selectedId]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    function handleClick(event: MapLayerMouseEvent) {
      const id = event.features?.[0]?.properties?.id;
      if (typeof id === "string") {
        select(id);
      }
    }
    const canvas = map.getCanvas();
    function showPointer() {
      canvas.style.cursor = "pointer";
    }
    function hidePointer() {
      canvas.style.cursor = "";
    }
    map.on("click", fillLayerId, handleClick);
    map.on("mouseenter", fillLayerId, showPointer);
    map.on("mouseleave", fillLayerId, hidePointer);
    return () => {
      map.off("click", fillLayerId, handleClick);
      map.off("mouseenter", fillLayerId, showPointer);
      map.off("mouseleave", fillLayerId, hidePointer);
      hidePointer();
    };
  }, [map, isLoaded]);

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
