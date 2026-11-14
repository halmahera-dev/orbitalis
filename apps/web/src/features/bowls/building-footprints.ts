import { classifyRings, VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";

import type { BuildingType } from "@/features/buildings/building-types";

import { polygonArea, polygonContains } from "@/features/buildings/building-shapes";

const styleUrl = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const tileZoom = 15;
const earthCircumferenceM = 40_075_017;
const defaultHeightMeters = 6;

const parkKinds = new Set([
  "park",
  "garden",
  "grass",
  "meadow",
  "village_green",
  "recreation_ground",
  "playground",
  "pitch",
  "forest",
  "wood",
  "nature_reserve",
  "scrub",
  "cemetery",
]);
const roadKinds = new Set(["highway", "major_road", "minor_road"]);

const zoneBuildingTypes = new Map<string, BuildingType>([
  ["school", "school"],
  ["kindergarten", "school"],
  ["college", "school"],
  ["university", "school"],
  ["hospital", "hospital"],
  ["industrial", "industrial"],
]);
const markerBuildingTypes = new Map<string, BuildingType>([
  ["place_of_worship", "worship"],
  ["school", "school"],
  ["kindergarten", "school"],
  ["college", "school"],
  ["university", "school"],
  ["hospital", "hospital"],
]);
const houseMaxHeightM = 9;
const houseMaxAreaM2 = 150;
const residentialHouseMaxAreaM2 = 300;

export type Footprint = {
  outline: [number, number][];
  holes: [number, number][][];
  heightMeters: number;
  type: BuildingType;
};

type Zone = {
  kind: string;
  outline: [number, number][];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
};

type Marker = { type: BuildingType; x: number; z: number };

function boundsOf(outline: [number, number][]) {
  const xs = outline.map(([x]) => x);
  const zs = outline.map(([, z]) => z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function classifyBuilding(
  outline: [number, number][],
  heightMeters: number,
  zones: Zone[],
  markers: Marker[],
): BuildingType {
  const marker = markers.find(({ x, z }) => polygonContains(outline, x, z));
  if (marker) {
    return marker.type;
  }
  const centerX = outline.reduce((sum, [x]) => sum + x, 0) / outline.length;
  const centerZ = outline.reduce((sum, [, z]) => sum + z, 0) / outline.length;
  const zone = zones.find(
    ({ bounds, outline: zoneOutline }) =>
      centerX >= bounds.minX &&
      centerX <= bounds.maxX &&
      centerZ >= bounds.minZ &&
      centerZ <= bounds.maxZ &&
      polygonContains(zoneOutline, centerX, centerZ),
  );
  const zoneType = zone ? zoneBuildingTypes.get(zone.kind) : undefined;
  if (zoneType) {
    return zoneType;
  }
  const maxArea = zone?.kind === "residential" ? residentialHouseMaxAreaM2 : houseMaxAreaM2;
  const canBeHouse = zone?.kind !== "commercial" && heightMeters <= houseMaxHeightM;
  return canBeHouse && polygonArea(outline) <= maxArea ? "house" : "generic";
}

export type Park = {
  outline: [number, number][];
  holes: [number, number][][];
};

export type Road = {
  line: [number, number][];
  kind: string;
};

export type TileData = {
  footprints: Footprint[];
  parks: Park[];
  roads: Road[];
};

type TileSource = { tiles: string[] };

async function fetchTileTemplate(signal: AbortSignal) {
  const response = await fetch(styleUrl, { signal });
  const style: { sources: Record<string, TileSource> } = await response.json();
  return style.sources.protomaps.tiles[0];
}

function worldPosition(longitude: number, latitude: number) {
  const sine = Math.sin((latitude * Math.PI) / 180);
  return {
    x: (longitude + 180) / 360,
    y: 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI),
  };
}

// Local meters around the center: x is east, z is south, like the scene.
export async function loadFootprints(
  center: [number, number],
  halfSizeM: number,
  signal: AbortSignal,
) {
  const template = await fetchTileTemplate(signal);
  const origin = worldPosition(center[0], center[1]);
  const metersPerWorldUnit = earthCircumferenceM * Math.cos((center[1] * Math.PI) / 180);
  const halfWorld = halfSizeM / metersPerWorldUnit;
  const tileCount = 2 ** tileZoom;
  const firstX = Math.floor((origin.x - halfWorld) * tileCount);
  const lastX = Math.floor((origin.x + halfWorld) * tileCount);
  const firstY = Math.floor((origin.y - halfWorld) * tileCount);
  const lastY = Math.floor((origin.y + halfWorld) * tileCount);

  const requests: Promise<TileData>[] = [];
  for (let tileX = firstX; tileX <= lastX; tileX += 1) {
    for (let tileY = firstY; tileY <= lastY; tileY += 1) {
      requests.push(loadTileData(template, tileX, tileY));
    }
  }
  const tiles = await Promise.all(requests);
  return {
    footprints: tiles.flatMap((tile) => tile.footprints),
    parks: tiles.flatMap((tile) => tile.parks),
    roads: tiles.flatMap((tile) => tile.roads),
  };

  async function loadTileData(urlTemplate: string, tileX: number, tileY: number) {
    const url = urlTemplate
      .replace("{z}", String(tileZoom))
      .replace("{x}", String(tileX))
      .replace("{y}", String(tileY));
    const result: TileData = { footprints: [], parks: [], roads: [] };
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return result;
    }
    const tile = new VectorTile(new PbfReader(new Uint8Array(await response.arrayBuffer())));

    function toLocal(point: { x: number; y: number }, extent: number): [number, number] {
      return [
        ((tileX + point.x / extent) / tileCount - origin.x) * metersPerWorldUnit,
        ((tileY + point.y / extent) / tileCount - origin.y) * metersPerWorldUnit,
      ];
    }
    function clamp([x, z]: [number, number]): [number, number] {
      return [
        Math.max(-halfSizeM, Math.min(halfSizeM, x)),
        Math.max(-halfSizeM, Math.min(halfSizeM, z)),
      ];
    }
    function isInside([x, z]: [number, number]) {
      return Math.abs(x) <= halfSizeM && Math.abs(z) <= halfSizeM;
    }

    const zones: Zone[] = [];
    const landuse = tile.layers.landuse;
    for (let index = 0; landuse && index < landuse.length; index += 1) {
      const feature = landuse.feature(index);
      const kind = String(feature.properties.kind);
      const isPark = parkKinds.has(kind);
      const isZone = zoneBuildingTypes.has(kind) || kind === "residential" || kind === "commercial";
      if (!isPark && !isZone) {
        continue;
      }
      for (const [outer, ...holes] of classifyRings(feature.loadGeometry())) {
        if (isZone) {
          const outline = outer.map((point) => toLocal(point, landuse.extent));
          zones.push({ kind, outline, bounds: boundsOf(outline) });
        }
        if (isPark) {
          result.parks.push({
            outline: outer.map((point) => clamp(toLocal(point, landuse.extent))),
            holes: holes.map((hole) => hole.map((point) => clamp(toLocal(point, landuse.extent)))),
          });
        }
      }
    }

    const markers: Marker[] = [];
    const pois = tile.layers.pois;
    for (let index = 0; pois && index < pois.length; index += 1) {
      const feature = pois.feature(index);
      const type = markerBuildingTypes.get(String(feature.properties.kind));
      if (!type) {
        continue;
      }
      const [x, z] = toLocal(feature.loadGeometry()[0][0], pois.extent);
      markers.push({ type, x, z });
    }

    const buildings = tile.layers.buildings;
    for (let index = 0; buildings && index < buildings.length; index += 1) {
      const feature = buildings.feature(index);
      const heightMeters = Number(feature.properties.height) || defaultHeightMeters;
      for (const [outer, ...holes] of classifyRings(feature.loadGeometry())) {
        const outline = outer.map((point) => toLocal(point, buildings.extent));
        if (outline.every(isInside)) {
          result.footprints.push({
            outline,
            holes: holes.map((hole) => hole.map((point) => toLocal(point, buildings.extent))),
            heightMeters,
            type: classifyBuilding(outline, heightMeters, zones, markers),
          });
        }
      }
    }

    const roads = tile.layers.roads;
    for (let index = 0; roads && index < roads.length; index += 1) {
      const feature = roads.feature(index);
      const kind = String(feature.properties.kind);
      if (!roadKinds.has(kind)) {
        continue;
      }
      for (const line of feature.loadGeometry()) {
        const points = line.map((point) => toLocal(point, roads.extent));
        if (points.every(isInside)) {
          result.roads.push({ line: points, kind });
        }
      }
    }
    return result;
  }
}
