import * as THREE from "three";

import type { Footprint } from "@/features/bowls/building-footprints";

import { buildingTypes, paletteSize } from "@/features/buildings/building-types";

export const trimMeters = 0.45;
export const wallKind = 0;
export const roofKind = 1;
export const trimKind = 2;
export const glowKind = 7;

const minBoxFill = 0.82;
const domeSegments = { around: 12, rings: 5 };

export type PartContext = { footprint: Footprint; share: number | undefined };

export type OrientedBox = {
  area: number;
  cx: number;
  cz: number;
  axis: [number, number];
  long: number;
  short: number;
};

// Three corners and a point inside the solid. The point decides which way the face looks.
export type Facet = [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3];

function hashFraction(x: number, z: number) {
  const wave = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return Math.abs(wave - Math.floor(wave));
}

export function hashOf(footprint: Footprint, salt: number) {
  const [x, z] = footprint.outline[0];
  return hashFraction(x + salt, z - salt * 0.37);
}

export function polygonArea(outline: [number, number][]) {
  let sum = 0;
  for (let index = 0; index < outline.length; index += 1) {
    const [x1, z1] = outline[index];
    const [x2, z2] = outline[(index + 1) % outline.length];
    sum += x1 * z2 - x2 * z1;
  }
  return Math.abs(sum) / 2;
}

export function polygonContains(outline: [number, number][], x: number, z: number) {
  let inside = false;
  for (let index = 0, previous = outline.length - 1; index < outline.length; previous = index++) {
    const [x1, z1] = outline[index];
    const [x2, z2] = outline[previous];
    if (z1 > z !== z2 > z && x < ((x2 - x1) * (z - z1)) / (z2 - z1) + x1) {
      inside = !inside;
    }
  }
  return inside;
}

export function centerOf(outline: [number, number][]): [number, number] {
  return [
    outline.reduce((sum, [x]) => sum + x, 0) / outline.length,
    outline.reduce((sum, [, z]) => sum + z, 0) / outline.length,
  ];
}

// The outline corner farthest from the center, pulled inward so a tower stands inside the walls.
export function cornerOf(outline: [number, number][], pullMeters: number): [number, number] {
  const [centerX, centerZ] = centerOf(outline);
  const [cornerX, cornerZ] = outline.reduce((far, point) =>
    Math.hypot(point[0] - centerX, point[1] - centerZ) >
    Math.hypot(far[0] - centerX, far[1] - centerZ)
      ? point
      : far,
  );
  const distance = Math.hypot(cornerX - centerX, cornerZ - centerZ) || 1;
  return [
    cornerX + ((centerX - cornerX) / distance) * pullMeters,
    cornerZ + ((centerZ - cornerZ) / distance) * pullMeters,
  ];
}

export function addFacadeAttributes(
  geometry: THREE.BufferGeometry,
  footprint: Footprint,
  forcedKind: number | null,
  share: number | undefined,
) {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const count = positions.count;
  const grid = new Float32Array(count * 2);
  const kind = new Float32Array(count);
  const tint = new Float32Array(count * 2);
  const hash = hashOf(footprint, 0);
  const typeIndex = buildingTypes.indexOf(footprint.type);
  for (let index = 0; index < count; index += 1) {
    const normalY = normals.getY(index);
    if (forcedKind !== null) {
      kind[index] = forcedKind;
    } else if (normalY > 0.95) {
      kind[index] = roofKind;
    } else if (normalY > 0.3) {
      kind[index] = trimKind;
    } else {
      kind[index] = wallKind;
    }
    const alongX = Math.abs(normals.getX(index)) > Math.abs(normals.getZ(index));
    grid[index * 2] = alongX ? positions.getZ(index) : positions.getX(index);
    grid[index * 2 + 1] = positions.getY(index);
    tint[index * 2] = typeIndex * paletteSize + Math.floor(hash * paletteSize);
    tint[index * 2 + 1] = (hash * paletteSize) % 1;
  }
  geometry.deleteAttribute("uv");
  geometry.setAttribute("grid", new THREE.BufferAttribute(grid, 2));
  geometry.setAttribute("kind", new THREE.BufferAttribute(kind, 1));
  geometry.setAttribute("tint", new THREE.BufferAttribute(tint, 2));
  if (share !== undefined) {
    geometry.setAttribute(
      "share",
      new THREE.BufferAttribute(new Float32Array(count).fill(share), 1),
    );
  }
}

export function extrudeFootprint(
  { footprint, share }: PartContext,
  wallHeight: number,
): THREE.BufferGeometry {
  const shape = new THREE.Shape(footprint.outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of footprint.holes) {
    shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(wallHeight - trimMeters, 0.5),
    bevelEnabled: true,
    bevelThickness: trimMeters,
    bevelSize: trimMeters,
    bevelOffset: -trimMeters,
    bevelSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  addFacadeAttributes(geometry, footprint, null, share);
  return geometry;
}

// The smallest rectangle, turned to match one footprint edge. `axis` points along the long side.
export function orientedBox(outline: [number, number][]) {
  let best: OrientedBox | null = null;
  for (let index = 0; index < outline.length; index += 1) {
    const [x1, z1] = outline[index];
    const [x2, z2] = outline[(index + 1) % outline.length];
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length < 0.01) {
      continue;
    }
    const ux = (x2 - x1) / length;
    const uz = (z2 - z1) / length;
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const [x, z] of outline) {
      const u = x * ux + z * uz;
      const v = -x * uz + z * ux;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const sizeU = maxU - minU;
    const sizeV = maxV - minV;
    if (best && sizeU * sizeV >= best.area) {
      continue;
    }
    const centerU = (minU + maxU) / 2;
    const centerV = (minV + maxV) / 2;
    best = {
      area: sizeU * sizeV,
      cx: centerU * ux - centerV * uz,
      cz: centerU * uz + centerV * ux,
      axis: sizeU >= sizeV ? [ux, uz] : [-uz, ux],
      long: Math.max(sizeU, sizeV) / 2,
      short: Math.min(sizeU, sizeV) / 2,
    };
  }
  return best;
}

export function boxyBox(outline: [number, number][]) {
  const box = orientedBox(outline);
  return box && polygonArea(outline) / box.area >= minBoxFill ? box : null;
}

export function boxPoint(box: OrientedBox, along: number, across: number, y: number) {
  const [ax, az] = box.axis;
  return new THREE.Vector3(box.cx + along * ax - across * az, y, box.cz + along * az + across * ax);
}

export function facetGeometry(facets: Facet[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [p, q, r, inside] of facets) {
    const normal = new THREE.Vector3()
      .subVectors(q, p)
      .cross(new THREE.Vector3().subVectors(r, p))
      .normalize();
    const centroid = new THREE.Vector3().add(p).add(q).add(r).divideScalar(3);
    const facesOut = normal.dot(centroid.sub(inside)) >= 0;
    if (!facesOut) {
      normal.negate();
    }
    for (const vertex of facesOut ? [p, q, r] : [p, r, q]) {
      positions.push(vertex.x, vertex.y, vertex.z);
      normals.push(normal.x, normal.y, normal.z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

function placed(
  source: THREE.BufferGeometry,
  { footprint, share }: PartContext,
  at: { x: number; y: number; z: number; kind: number; turn?: number },
) {
  const geometry = source.toNonIndexed();
  source.dispose();
  geometry.rotateY(at.turn ?? 0);
  geometry.translate(at.x, at.y, at.z);
  addFacadeAttributes(geometry, footprint, at.kind, share);
  return geometry;
}

type Spot = { x: number; y: number; z: number; kind: number; turn?: number };

export function columnPart(
  context: PartContext,
  spot: Spot & { radius: number; height: number; segments?: number },
) {
  const { radius, height, segments = 8 } = spot;
  return placed(new THREE.CylinderGeometry(radius, radius, height, segments), context, {
    ...spot,
    y: spot.y + height / 2,
  });
}

export function conePart(
  context: PartContext,
  spot: Spot & { radius: number; height: number; segments?: number },
) {
  const { radius, height, segments = 8 } = spot;
  return placed(new THREE.ConeGeometry(radius, height, segments), context, {
    ...spot,
    y: spot.y + height / 2,
  });
}

export function domePart(context: PartContext, spot: Spot & { radius: number }) {
  const { around, rings } = domeSegments;
  return placed(
    new THREE.SphereGeometry(spot.radius, around, rings, 0, Math.PI * 2, 0, Math.PI / 2),
    context,
    spot,
  );
}

export function boxPart(
  context: PartContext,
  spot: Spot & { width: number; height: number; depth: number },
) {
  return placed(new THREE.BoxGeometry(spot.width, spot.height, spot.depth), context, {
    ...spot,
    y: spot.y + spot.height / 2,
  });
}
