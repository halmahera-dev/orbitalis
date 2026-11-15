"use client";

import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";

import { useEffect, useEffectEvent } from "react";

import { useMap } from "@/components/ui/map";
import { circle, type MapBowl } from "@/features/map/components/bowl-layer";
import { firstSymbolLayerId, themeColor } from "@/features/nisar/components/nisar-layers";

const sourceId = "orbitalis-sites";
const fillLayerId = `${sourceId}-fill`;
const ringLayerId = `${sourceId}-ring`;
const layerIds = [fillLayerId, ringLayerId];
const minimumRadiusM = 120;

const isSelected: ExpressionSpecification = ["==", ["get", "selected"], 1];
const needsVisit: ExpressionSpecification = ["==", ["get", "needsVisit"], 1];

type MapSite = MapBowl & { needsVisit: boolean };

function toFeatureCollection(
  sites: MapSite[],
  selectedId: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: sites.map((site) => ({
      type: "Feature",
      properties: {
        id: site.id,
        selected: site.id === selectedId ? 1 : 0,
        needsVisit: site.needsVisit ? 1 : 0,
      },
      geometry: circle(site.center, Math.max(site.radiusM, minimumRadiusM)),
    })),
  };
}

export function SiteLayer({
  sites,
  selectedId,
  onSelect,
}: {
  sites: MapSite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { map, isLoaded } = useMap();
  const select = useEffectEvent(onSelect);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const data = toFeatureCollection(sites, selectedId);
    const source = map.getSource<GeoJSONSource>(sourceId);
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(sourceId, { type: "geojson", data });
    const beforeLayerId = firstSymbolLayerId(map);
    map.addLayer(
      {
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": [
            "case",
            needsVisit,
            themeColor("--rate-fast"),
            themeColor("--chart-5"),
          ] as ExpressionSpecification,
          "fill-opacity": ["case", isSelected, 0.7, 0.45] as ExpressionSpecification,
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
          "line-color": themeColor("--foreground"),
          "line-width": ["case", isSelected, 3, 1] as ExpressionSpecification,
          "line-opacity": ["case", isSelected, 1, 0.3] as ExpressionSpecification,
        },
      },
      beforeLayerId,
    );
  }, [map, isLoaded, sites, selectedId]);

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
