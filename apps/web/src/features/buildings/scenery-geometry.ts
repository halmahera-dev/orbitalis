import * as THREE from "three";

import type { Footprint, Park, Road } from "@/features/bowls/building-footprints";

import { polygonContains } from "@/features/buildings/building-shapes";

const parkKind = 3;
const roadKind = 4;
const canopyKind = 5;
const trunkKind = 6;
const glowKind = 7;

const maxEdgeMeters = 14;
const sidewalkMeters = 1.2;
const parkLiftMeters = 0.1;
const lampSpacingMeters = 36;
const lampHeightMeters = 6.5;
const streetTreeSpacingMeters = 18;
const parkTreeSpacingMeters = 11;
const maxTrees = 3000;
const maxLamps = 1000;
const blockedCellMeters = 3;

const roadStyles: Record<string, { carriagewayMeters: number; rank: number; marking: number }> = {
  highway: { carriagewayMeters: 12, rank: 2, marking: 1 },
  major_road: { carriagewayMeters: 9, rank: 1, marking: 1 },
  minor_road: { carriagewayMeters: 6, rank: 0, marking: 0 },
};

type Point = [number, number];
type Vec3 = [number, number, number];
type Corner = { point: Vec3; grid: Point };
type ShareAt = ((x: number, z: number) => number) | undefined;
type Site = { x: number; z: number; seed: number };

type MeshData = {
  position: number[];
  normal: number[];
  grid: number[];
  kind: number[];
  tint: number[];
  share: number[];
};

function hashFraction(x: number, z: number) {
  const wave = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return Math.abs(wave - Math.floor(wave));
}

function plain(point: Vec3): Corner {
  return { point, grid: [0, 0] };
}

function addTriangle(
  mesh: MeshData,
  shareAt: ShareAt,
  corners: [Corner, Corner, Corner],
  normal: Vec3,
  kind: number,
  tint: Point,
) {
  for (const { point, grid } of corners) {
    mesh.position.push(...point);
    mesh.normal.push(...normal);
    mesh.grid.push(...grid);
    mesh.kind.push(kind);
    mesh.tint.push(...tint);
    mesh.share.push(shareAt ? shareAt(point[0], point[2]) : 0);
  }
}

function addSolidTriangle(
  mesh: MeshData,
  shareAt: ShareAt,
  corners: [Vec3, Vec3, Vec3],
  center: Vec3,
  kind: number,
  tint: Point,
) {
  const [a, b, c] = corners;
  const edge1 = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const edge2 = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
  const normal = edge1.cross(edge2).normalize();
  const outward = new THREE.Vector3(
    (a[0] + b[0] + c[0]) / 3 - center[0],
    (a[1] + b[1] + c[1]) / 3 - center[1],
    (a[2] + b[2] + c[2]) / 3 - center[2],
  );
  if (normal.dot(outward) < 0) {
    normal.negate();
  }
  addTriangle(
    mesh,
    shareAt,
    [plain(a), plain(b), plain(c)],
    [normal.x, normal.y, normal.z],
    kind,
    tint,
  );
}

function addBox(
  mesh: MeshData,
  shareAt: ShareAt,
  box: { x: number; z: number; bottom: number; width: number; height: number; closed: boolean },
  kind: number,
  tint: Point,
) {
  const { x, z, bottom, width, height, closed } = box;
  const half = width / 2;
  const top = bottom + height;
  const center: Vec3 = [x, bottom + height / 2, z];
  const low: Vec3[] = [
    [x - half, bottom, z - half],
    [x + half, bottom, z - half],
    [x + half, bottom, z + half],
    [x - half, bottom, z + half],
  ];
  const high = low.map(([lowX, , lowZ]): Vec3 => [lowX, top, lowZ]);
  for (let side = 0; side < 4; side += 1) {
    const next = (side + 1) % 4;
    addSolidTriangle(mesh, shareAt, [low[side], low[next], high[next]], center, kind, tint);
    addSolidTriangle(mesh, shareAt, [low[side], high[next], high[side]], center, kind, tint);
  }
  if (closed) {
    addSolidTriangle(mesh, shareAt, [low[0], low[1], low[2]], center, kind, tint);
    addSolidTriangle(mesh, shareAt, [low[0], low[2], low[3]], center, kind, tint);
    addSolidTriangle(mesh, shareAt, [high[0], high[1], high[2]], center, kind, tint);
    addSolidTriangle(mesh, shareAt, [high[0], high[2], high[3]], center, kind, tint);
  }
}

function addTree(mesh: MeshData, shareAt: ShareAt, { x, z, seed }: Site) {
  const height = 5 + seed * 3;
  const radius = 1.8 + seed;
  const trunkHeight = height * 0.35;
  const equator = trunkHeight + (height - trunkHeight) * 0.45;
  const tint: Point = [0, seed];
  addBox(
    mesh,
    shareAt,
    { x, z, bottom: 0, width: 0.35, height: trunkHeight, closed: false },
    trunkKind,
    tint,
  );
  const sides = 6;
  const turn = seed * Math.PI;
  const ring = Array.from({ length: sides }, (_, index): Vec3 => {
    const angle = turn + (index / sides) * Math.PI * 2;
    return [x + Math.cos(angle) * radius, equator, z + Math.sin(angle) * radius];
  });
  const topApex: Vec3 = [x, height, z];
  const bottomApex: Vec3 = [x, trunkHeight, z];
  const center: Vec3 = [x, equator, z];
  for (let index = 0; index < sides; index += 1) {
    const next = ring[(index + 1) % sides];
    addSolidTriangle(mesh, shareAt, [ring[index], next, topApex], center, canopyKind, tint);
    addSolidTriangle(mesh, shareAt, [ring[index], next, bottomApex], center, canopyKind, tint);
  }
}

function addLamp(mesh: MeshData, shareAt: ShareAt, { x, z }: Site) {
  const tint: Point = [0, 0];
  addBox(
    mesh,
    shareAt,
    { x, z, bottom: 0, width: 0.22, height: lampHeightMeters, closed: false },
    trunkKind,
    tint,
  );
  addBox(
    mesh,
    shareAt,
    { x, z, bottom: lampHeightMeters - 0.3, width: 0.8, height: 0.4, closed: true },
    glowKind,
    tint,
  );
}

function splitTriangle(a: Point, b: Point, c: Point, emit: (a: Point, b: Point, c: Point) => void) {
  const longest = Math.max(
    Math.hypot(a[0] - b[0], a[1] - b[1]),
    Math.hypot(b[0] - c[0], b[1] - c[1]),
    Math.hypot(c[0] - a[0], c[1] - a[1]),
  );
  if (longest <= maxEdgeMeters) {
    emit(a, b, c);
    return;
  }
  const ab: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const bc: Point = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
  const ca: Point = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
  splitTriangle(a, ab, ca, emit);
  splitTriangle(ab, b, bc, emit);
  splitTriangle(ca, bc, c, emit);
  splitTriangle(ab, bc, ca, emit);
}

function addPark(mesh: MeshData, shareAt: ShareAt, park: Park) {
  const contour = park.outline.map(([x, z]) => new THREE.Vector2(x, z));
  const holes = park.holes.map((hole) => hole.map(([x, z]) => new THREE.Vector2(x, z)));
  const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
  const points = [...contour, ...holes.flat()].map((vector): Point => [vector.x, vector.y]);
  function corner([x, z]: Point): Corner {
    return { point: [x, parkLiftMeters, z], grid: [x, z] };
  }
  for (const [first, second, third] of faces) {
    if (shareAt) {
      splitTriangle(points[first], points[second], points[third], emitPark);
    } else {
      emitPark(points[first], points[second], points[third]);
    }
  }
  function emitPark(a: Point, b: Point, c: Point) {
    addTriangle(mesh, shareAt, [corner(a), corner(b), corner(c)], [0, 1, 0], parkKind, [0, 0]);
  }
}

function densify(line: Point[]) {
  const result: Point[] = [line[0]];
  for (let index = 1; index < line.length; index += 1) {
    const [fromX, fromZ] = line[index - 1];
    const [toX, toZ] = line[index];
    const pieces = Math.ceil(Math.hypot(toX - fromX, toZ - fromZ) / maxEdgeMeters);
    for (let piece = 1; piece <= pieces; piece += 1) {
      const t = piece / pieces;
      result.push([fromX + (toX - fromX) * t, fromZ + (toZ - fromZ) * t]);
    }
  }
  return result;
}

function addRoad(
  mesh: MeshData,
  shareAt: ShareAt,
  road: Road,
  index: number,
  lamps: Site[],
  streetTrees: Site[],
) {
  const style = roadStyles[road.kind];
  const half = style.carriagewayMeters / 2 + sidewalkMeters;
  const y = 0.15 + style.rank * 0.25 + (index % 16) * 0.01;
  const points = densify(road.line);
  const sides = points.map((point, pointIndex) => {
    const [previousX, previousZ] = points[Math.max(pointIndex - 1, 0)];
    const [nextX, nextZ] = points[Math.min(pointIndex + 1, points.length - 1)];
    const length = Math.hypot(nextX - previousX, nextZ - previousZ) || 1;
    return { alongX: (nextX - previousX) / length, alongZ: (nextZ - previousZ) / length, point };
  });
  const tint: Point = [half, style.marking];
  let along = 0;
  let nextLamp = lampSpacingMeters / 2;
  let nextTree = streetTreeSpacingMeters / 2;
  let flip = index % 2 === 0 ? 1 : -1;
  const edges = sides.map(({ alongX, alongZ, point: [x, z] }, sideIndex) => {
    if (sideIndex > 0) {
      const [previousX, previousZ] = points[sideIndex - 1];
      along += Math.hypot(x - previousX, z - previousZ);
    }
    const left = {
      point: [x - alongZ * half, y, z + alongX * half] as Vec3,
      grid: [-half, along] as Point,
    };
    const right = {
      point: [x + alongZ * half, y, z - alongX * half] as Vec3,
      grid: [half, along] as Point,
    };
    if (along >= nextLamp) {
      nextLamp += lampSpacingMeters;
      const lateral = (half - 0.6) * flip;
      lamps.push({ x: x - alongZ * lateral, z: z + alongX * lateral, seed: 0 });
      flip = -flip;
    }
    if (road.kind === "minor_road" && along >= nextTree) {
      nextTree += streetTreeSpacingMeters;
      const lateral = (half + 1.8) * -flip;
      streetTrees.push({
        x: x - alongZ * lateral,
        z: z + alongX * lateral,
        seed: hashFraction(x, z),
      });
    }
    return [left, right] as const;
  });
  for (let edge = 0; edge + 1 < edges.length; edge += 1) {
    const [leftA, rightA] = edges[edge];
    const [leftB, rightB] = edges[edge + 1];
    addTriangle(mesh, shareAt, [leftA, rightA, leftB], [0, 1, 0], roadKind, tint);
    addTriangle(mesh, shareAt, [rightA, rightB, leftB], [0, 1, 0], roadKind, tint);
  }
}

function blockedBy(footprints: Footprint[]) {
  const blocked = new Set<number>();
  function key(cellX: number, cellZ: number) {
    return cellX * 100_000 + cellZ;
  }
  for (const { outline } of footprints) {
    const xs = outline.map(([x]) => x);
    const zs = outline.map(([, z]) => z);
    const lastX = Math.floor(Math.max(...xs) / blockedCellMeters);
    const lastZ = Math.floor(Math.max(...zs) / blockedCellMeters);
    for (let cellX = Math.floor(Math.min(...xs) / blockedCellMeters); cellX <= lastX; cellX += 1) {
      for (
        let cellZ = Math.floor(Math.min(...zs) / blockedCellMeters);
        cellZ <= lastZ;
        cellZ += 1
      ) {
        const centerX = (cellX + 0.5) * blockedCellMeters;
        const centerZ = (cellZ + 0.5) * blockedCellMeters;
        if (polygonContains(outline, centerX, centerZ)) {
          blocked.add(key(cellX, cellZ));
        }
      }
    }
  }
  return function isBlocked(x: number, z: number) {
    return [
      [0, 0],
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ].some(([offsetX, offsetZ]) =>
      blocked.has(
        key(
          Math.floor((x + offsetX) / blockedCellMeters),
          Math.floor((z + offsetZ) / blockedCellMeters),
        ),
      ),
    );
  };
}

function parkTreeSites(park: Park) {
  const xs = park.outline.map(([x]) => x);
  const zs = park.outline.map(([, z]) => z);
  const sites: Site[] = [];
  for (let x = Math.min(...xs); x < Math.max(...xs); x += parkTreeSpacingMeters) {
    for (let z = Math.min(...zs); z < Math.max(...zs); z += parkTreeSpacingMeters) {
      const seed = hashFraction(x, z);
      const site = {
        x: x + hashFraction(z, x) * parkTreeSpacingMeters,
        z: z + seed * parkTreeSpacingMeters,
        seed,
      };
      const isInHole = park.holes.some((hole) => polygonContains(hole, site.x, site.z));
      if (polygonContains(park.outline, site.x, site.z) && !isInHole) {
        sites.push(site);
      }
    }
  }
  return sites;
}

function nearest(sites: Site[], limit: number) {
  return sites.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z)).slice(0, limit);
}

// Local meters: x is east, y is up, z is south. `shareAt` adds the per-vertex "share" attribute.
export function buildSceneryGeometry(
  scenery: { footprints: Footprint[]; parks: Park[]; roads: Road[] },
  shareAt?: (x: number, z: number) => number,
) {
  const mesh: MeshData = { position: [], normal: [], grid: [], kind: [], tint: [], share: [] };
  const lamps: Site[] = [];
  const streetTrees: Site[] = [];
  for (const park of scenery.parks) {
    addPark(mesh, shareAt, park);
  }
  scenery.roads.forEach((road, index) => addRoad(mesh, shareAt, road, index, lamps, streetTrees));
  const isBlocked = blockedBy(scenery.footprints);
  const trees = scenery.parks.flatMap(parkTreeSites).concat(streetTrees);
  for (const tree of nearest(
    trees.filter((tree) => !isBlocked(tree.x, tree.z)),
    maxTrees,
  )) {
    addTree(mesh, shareAt, tree);
  }
  for (const lamp of nearest(
    lamps.filter((lamp) => !isBlocked(lamp.x, lamp.z)),
    maxLamps,
  )) {
    addLamp(mesh, shareAt, lamp);
  }
  if (mesh.position.length === 0) {
    return null;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(mesh.position, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mesh.normal, 3));
  geometry.setAttribute("grid", new THREE.Float32BufferAttribute(mesh.grid, 2));
  geometry.setAttribute("kind", new THREE.Float32BufferAttribute(mesh.kind, 1));
  geometry.setAttribute("tint", new THREE.Float32BufferAttribute(mesh.tint, 2));
  geometry.setAttribute("share", new THREE.Float32BufferAttribute(mesh.share, 1));
  return geometry;
}
