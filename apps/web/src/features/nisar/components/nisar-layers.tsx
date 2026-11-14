"use client";

import type {
  Coordinates,
  ExpressionSpecification,
  ImageSource,
  Map as MapLibreMap,
} from "maplibre-gl";

import { useEffect } from "react";

import type { InterferogramPair } from "@/features/nisar/nisar-catalog";

import { useMap } from "@/components/ui/map";
import { buildingPalette } from "@/lib/building-palette";
import { resolveColor } from "@/lib/dither";

const interferogramId = "nisar-interferogram";
const buildingsId = "buildings-3d";
const buildingsRoofId = "buildings-roof";
const buildingsDetailId = "buildings-detail";
const cornerMeters = 4;
const roofBandMeters = 0.5;
const defaultHeightMeters = 6;
const nightLightIntensity = 0.3;
const dayLightIntensity = 0.2;

export function themeColor(variable: string) {
  const [red, green, blue, alpha] = resolveColor(variable);
  return `rgba(${red * 255}, ${green * 255}, ${blue * 255}, ${alpha})`;
}

export function firstSymbolLayerId(map: MapLibreMap) {
  return map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
}

export function InterferogramLayer({ pair }: { pair: InterferogramPair }) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) {
      return;
    }
    const coordinates = pair.corners as Coordinates;
    const source = map.getSource<ImageSource>(interferogramId);
    if (source) {
      source.updateImage({ url: pair.image, coordinates });
      return;
    }
    map.addSource(interferogramId, { type: "image", url: pair.image, coordinates });
    map.addLayer(
      {
        id: interferogramId,
        type: "raster",
        source: interferogramId,
        paint: { "raster-opacity": 0.8, "raster-fade-duration": 0 },
      },
      firstSymbolLayerId(map),
    );
  }, [map, isLoaded, pair]);

  useEffect(() => {
    return () => {
      if (!map?.getStyle()) {
        return;
      }
      if (map.getLayer(interferogramId)) {
        map.removeLayer(interferogramId);
      }
      if (map.getSource(interferogramId)) {
        map.removeSource(interferogramId);
      }
    };
  }, [map]);

  return null;
}

const buildingHeight: ExpressionSpecification = [
  "coalesce",
  ["get", "height"],
  defaultHeightMeters,
];
const buildingBase: ExpressionSpecification = ["coalesce", ["get", "min_height"], 0];
const wallTop: ExpressionSpecification = [
  "max",
  ["-", buildingHeight, roofBandMeters],
  buildingBase,
];
function wallColorExpression(walls: string[]): ExpressionSpecification {
  const [first, ...rest] = walls;
  const arms = rest.flatMap((wall, index) => [index + 1, wall]);
  return ["match", ["%", ["to-number", ["id"], 0], walls.length], 0, first, ...arms, first];
}

// Building heights come from the Carto (Protomaps schema) tiles in the basemap.
export function BuildingsLayer() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded || map.getLayer(buildingsId)) {
      return;
    }
    const isDark = document.documentElement.classList.contains("dark");
    const palette = buildingPalette();
    map.setLight({
      anchor: "viewport",
      color: "#ffffff",
      intensity: isDark ? nightLightIntensity : dayLightIntensity,
    });
    for (const layer of map.getStyle().layers) {
      if (layer.type === "fill" && layer.id.startsWith("building")) {
        map.setLayoutProperty(layer.id, "visibility", "none");
      }
    }

    const before = firstSymbolLayerId(map);
    const layout = { "fill-extrusion-rounded-corner-distance": cornerMeters };
    map.addLayer(
      {
        id: buildingsId,
        type: "fill-extrusion",
        source: "protomaps",
        "source-layer": "buildings",
        minzoom: 12,
        layout,
        paint: {
          "fill-extrusion-color": wallColorExpression(palette.walls),
          "fill-extrusion-base": buildingBase,
          "fill-extrusion-height": wallTop,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      before,
    );
    map.addLayer(
      {
        id: buildingsRoofId,
        type: "fill-extrusion",
        source: "protomaps",
        "source-layer": "buildings",
        minzoom: 12,
        layout,
        paint: {
          "fill-extrusion-color": wallColorExpression(palette.roofs),
          "fill-extrusion-base": wallTop,
          "fill-extrusion-height": buildingHeight,
          "fill-extrusion-opacity": 1,
          "fill-extrusion-vertical-gradient": true,
        },
      },
      before,
    );
    let isCancelled = false;
    import("@/features/buildings/building-map-layer").then(({ createBuildingLayer }) => {
      if (!isCancelled && map.getStyle() && !map.getLayer(buildingsDetailId)) {
        map.addLayer(
          createBuildingLayer(buildingsDetailId, palette, [buildingsId, buildingsRoofId]),
          before,
        );
      }
    });
    return () => {
      isCancelled = true;
      if (!map.getStyle()) {
        return;
      }
      for (const layerId of [buildingsDetailId, buildingsRoofId, buildingsId]) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
    };
  }, [map, isLoaded]);

  return null;
}
