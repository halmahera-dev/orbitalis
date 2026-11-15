"use client";

import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";

import { useEffect, useEffectEvent } from "react";

import type { PriorityArea } from "@/features/areas/areas-priority";

import { useMap } from "@/components/ui/map";
import { firstSymbolLayerId, themeColor } from "@/features/nisar/components/nisar-layers";

const sourceId = "orbitalis-areas";
const fillLayerId = `${sourceId}-fill`;
const outlineLayerId = `${sourceId}-outline`;
const layerIds = [fillLayerId, outlineLayerId];
const metersPerDegree = 111_320;
const selectedZoom = 14;

export type AreaCell = { area: PriorityArea; value: number; matches: boolean };

function cellPolygon([longitude, latitude]: [number, number], sizeM: number) {
  const halfLatitude = sizeM / 2 / metersPerDegree;
  const halfLongitude = halfLatitude / Math.cos((latitude * Math.PI) / 180);
  const west = longitude - halfLongitude;
  const east = longitude + halfLongitude;
  const south = latitude - halfLatitude;
  const north = latitude + halfLatitude;
  return {
    type: "Polygon" as const,
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function toFeatureCollection(
  cells: AreaCell[],
  sizeM: number,
  selectedAreaId: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cells.map((cell) => ({
      type: "Feature",
      properties: {
        id: cell.area.id,
        value: cell.value,
        matches: cell.matches ? 1 : 0,
        selected: cell.area.id === selectedAreaId ? 1 : 0,
      },
      geometry: cellPolygon(cell.area.center, sizeM),
    })),
  };
}

const isMatch: ExpressionSpecification = ["==", ["get", "matches"], 1];
const isSelected: ExpressionSpecification = ["==", ["get", "selected"], 1];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function AreaLayer({
  cells,
  cellSizeM,
  selectedAreaId,
  onSelect,
}: {
  cells: AreaCell[];
  cellSizeM: number;
  selectedAreaId: string | null;
  onSelect: (areaId: string) => void;
}) {
  const { map, isLoaded } = useMap();
  const selectArea = useEffectEvent(onSelect);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const data = toFeatureCollection(cells, cellSizeM, selectedAreaId);
    const source = map.getSource<GeoJSONSource>(sourceId);
    if (source) {
      source.setData(data);
      return;
    }
    map.addSource(sourceId, { type: "geojson", data });
    const beforeLayerId = firstSymbolLayerId(map);
    const priorityColor = themeColor("--rate-fast");
    map.addLayer(
      {
        id: fillLayerId,
        type: "fill",
        source: sourceId,
        paint: {
          "fill-color": priorityColor,
          "fill-opacity": [
            "case",
            isMatch,
            ["interpolate", ["linear"], ["get", "value"], 0, 0.08, 1, 0.72],
            0.02,
          ] as ExpressionSpecification,
        },
      },
      beforeLayerId,
    );
    map.addLayer(
      {
        id: outlineLayerId,
        type: "line",
        source: sourceId,
        paint: {
          "line-color": [
            "case",
            isSelected,
            themeColor("--foreground"),
            priorityColor,
          ] as ExpressionSpecification,
          "line-width": ["case", isSelected, 3, 0.5] as ExpressionSpecification,
          "line-opacity": ["case", isSelected, 1, isMatch, 0.35, 0] as ExpressionSpecification,
        },
      },
      beforeLayerId,
    );
  }, [map, isLoaded, cells, cellSizeM, selectedAreaId]);

  const selectedCenter = cells.find((cell) => cell.area.id === selectedAreaId)?.area.center;
  const selectedLongitude = selectedCenter?.[0];
  const selectedLatitude = selectedCenter?.[1];

  useEffect(() => {
    if (!map || !isLoaded || selectedLongitude === undefined || selectedLatitude === undefined) {
      return;
    }
    const camera = {
      center: [selectedLongitude, selectedLatitude] as [number, number],
      zoom: Math.max(map.getZoom(), selectedZoom),
    };
    if (prefersReducedMotion()) {
      map.jumpTo(camera);
      return;
    }
    map.easeTo({ ...camera, duration: 800 });
  }, [map, isLoaded, selectedLongitude, selectedLatitude]);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    function handleClick(event: MapLayerMouseEvent) {
      const feature = event.features?.[0];
      if (feature?.properties?.matches === 1 && typeof feature.properties.id === "string") {
        selectArea(feature.properties.id);
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
