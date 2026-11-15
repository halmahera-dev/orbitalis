"use client";

import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";

import { useEffect, useEffectEvent } from "react";

import type { Cell } from "@/features/bowls/bowls-queries";

import { useMap } from "@/components/ui/map";
import { firstSymbolLayerId, themeColor } from "@/features/nisar/components/nisar-layers";

const sourceId = "orbitalis-cells";
const fillLayerId = `${sourceId}-fill`;
const outlineLayerId = `${sourceId}-outline`;
const layerIds = [fillLayerId, outlineLayerId];
const metersPerDegree = 111_320;
const selectedZoom = 14;

export type CellLayerKind = "sinking" | "people";

export type CellScale = { kind: CellLayerKind; stops: [number, number, number] };

function valueOf(cell: Cell, kind: CellLayerKind, cellAreaKm2: number) {
  if (kind === "sinking") {
    return cell.sinkingMmYr;
  }
  return cell.people === null ? null : cell.people / cellAreaKm2;
}

function colorExpression({ kind, stops }: CellScale): ExpressionSpecification {
  const [low, middle, high] = stops;
  if (kind === "people") {
    return [
      "interpolate",
      ["linear"],
      ["get", "value"],
      low,
      themeColor("--chart-5"),
      high,
      themeColor("--chart-2"),
    ];
  }
  return [
    "interpolate",
    ["linear"],
    ["get", "value"],
    low,
    themeColor("--rate-slow"),
    middle,
    themeColor("--rate-middle"),
    high,
    themeColor("--rate-fast"),
  ];
}

function opacityExpression({ kind, stops }: CellScale): ExpressionSpecification {
  const [low, , high] = stops;
  const strength: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["get", "value"],
    low,
    0.04,
    high,
    kind === "people" ? 0.6 : 0.72,
  ];
  return ["*", strength, ["get", "covered"]];
}

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
  cells: Cell[],
  kind: CellLayerKind,
  sizeM: number,
  selectedCellId: string | null,
): GeoJSON.FeatureCollection {
  const areaKm2 = (sizeM / 1000) ** 2;
  return {
    type: "FeatureCollection",
    features: cells.flatMap((cell) => {
      const value = valueOf(cell, kind, areaKm2);
      if (value === null) {
        return [];
      }
      return [
        {
          type: "Feature" as const,
          properties: {
            id: cell.id,
            value,
            covered: kind === "sinking" ? cell.coveredShare : 1,
            selected: cell.id === selectedCellId ? 1 : 0,
          },
          geometry: cellPolygon(cell.center, sizeM),
        },
      ];
    }),
  };
}

const isSelected: ExpressionSpecification = ["==", ["get", "selected"], 1];

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function CellLayer({
  cells,
  cellSizeM,
  scale,
  selectedCellId,
  onSelect,
}: {
  cells: Cell[];
  cellSizeM: number;
  scale: CellScale;
  selectedCellId: string | null;
  onSelect: (cellId: string) => void;
}) {
  const { map, isLoaded } = useMap();
  const selectCell = useEffectEvent(onSelect);

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const data = toFeatureCollection(cells, scale.kind, cellSizeM, selectedCellId);
    const source = map.getSource<GeoJSONSource>(sourceId);
    if (source) {
      source.setData(data);
      map.setPaintProperty(fillLayerId, "fill-color", colorExpression(scale));
      map.setPaintProperty(fillLayerId, "fill-opacity", opacityExpression(scale));
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
          "fill-color": colorExpression(scale),
          "fill-opacity": opacityExpression(scale),
        },
      },
      beforeLayerId,
    );
    map.addLayer(
      {
        id: outlineLayerId,
        type: "line",
        source: sourceId,
        filter: isSelected,
        paint: {
          "line-color": themeColor("--foreground"),
          "line-width": 3,
        },
      },
      beforeLayerId,
    );
  }, [map, isLoaded, cells, cellSizeM, scale, selectedCellId]);

  const selectedCenter = cells.find((cell) => cell.id === selectedCellId)?.center;
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
      if (typeof feature?.properties?.id === "string") {
        selectCell(feature.properties.id);
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
