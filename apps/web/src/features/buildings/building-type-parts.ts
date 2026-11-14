import * as THREE from "three";

import {
  addFacadeAttributes,
  boxPart,
  boxPoint,
  boxyBox,
  centerOf,
  columnPart,
  conePart,
  cornerOf,
  domePart,
  extrudeFootprint,
  facetGeometry,
  glowKind,
  hashOf,
  orientedBox,
  polygonArea,
  polygonContains,
  roofKind,
  trimKind,
  trimMeters,
  type Facet,
  type OrientedBox,
  type PartContext,
} from "@/features/buildings/building-shapes";

const eaveOverhangM = 0.35;
const flatRoofHouseShare = 0.22;
const hipRoofAspect = 0.7;
const minRidgeRiseM = 1.4;
const maxRidgeRiseM = 3.2;
const minWallHeightM = 2.5;
const waterTank = { radius: 0.6, height: 1.2 };

const mosqueDrumHeightM = 1.4;
const minDomeRadiusM = 2;
const maxDomeRadiusM = 6;
const minaretRadiusM = 0.9;
const minaretMinRiseM = 12;

const crossDepthM = 0.5;
const flagpole = { radius: 0.07, height: 7 };

const sawtoothToothWidthM = 7;
const sawtoothRiseM = 1.6;
const chimneyShare = 0.35;
const chimneyRiseM = 8;

const roofBoxMinAreaM2 = 220;
const roofBoxMinHeightM = 9;
const roofBoxHeightM = 2.2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function pitchedRoof(
  context: PartContext,
  box: OrientedBox,
  wallHeight: number,
  ridgeRise: number,
  ridgeInset: number,
) {
  const long = box.long + eaveOverhangM;
  const short = box.short + eaveOverhangM;
  const ridgeY = wallHeight + ridgeRise;
  const a = boxPoint(box, -long, -short, wallHeight);
  const b = boxPoint(box, long, -short, wallHeight);
  const c = boxPoint(box, long, short, wallHeight);
  const d = boxPoint(box, -long, short, wallHeight);
  const ridgeStart = boxPoint(box, -long + ridgeInset, 0, ridgeY);
  const ridgeEnd = boxPoint(box, long - ridgeInset, 0, ridgeY);
  const inside = new THREE.Vector3(box.cx, wallHeight, box.cz);
  const geometry = facetGeometry([
    [a, b, ridgeEnd, inside],
    [a, ridgeEnd, ridgeStart, inside],
    [c, d, ridgeStart, inside],
    [c, ridgeStart, ridgeEnd, inside],
    [a, d, ridgeStart, inside],
    [b, ridgeEnd, c, inside],
  ]);
  addFacadeAttributes(geometry, context.footprint, roofKind, context.share);
  return geometry;
}

export function houseParts(context: PartContext) {
  const { footprint } = context;
  const box = boxyBox(footprint.outline);
  if (!box || hashOf(footprint, 3.1) < flatRoofHouseShare) {
    return flatHouseParts(context);
  }
  const ridgeRise = clamp(box.short * 0.8, minRidgeRiseM, maxRidgeRiseM);
  const wallHeight = Math.max(footprint.heightMeters - ridgeRise, minWallHeightM);
  const ridgeInset = box.short / box.long >= hipRoofAspect ? box.short : 0;
  return [
    extrudeFootprint(context, wallHeight),
    pitchedRoof(context, box, wallHeight, ridgeRise, ridgeInset),
  ];
}

function flatHouseParts(context: PartContext) {
  const { outline, heightMeters } = context.footprint;
  const parts = [extrudeFootprint(context, heightMeters)];
  const [centerX, centerZ] = centerOf(outline);
  if (polygonContains(outline, centerX, centerZ)) {
    parts.push(
      columnPart(context, {
        ...waterTank,
        x: centerX,
        y: heightMeters,
        z: centerZ,
        kind: trimKind,
      }),
    );
  }
  return parts;
}

export function mosqueParts(context: PartContext) {
  const { outline, heightMeters } = context.footprint;
  const parts = [extrudeFootprint(context, heightMeters)];
  const [centerX, centerZ] = centerOf(outline);
  const radius = clamp(Math.sqrt(polygonArea(outline)) * 0.3, minDomeRadiusM, maxDomeRadiusM);
  if (polygonContains(outline, centerX, centerZ)) {
    const domeY = heightMeters + mosqueDrumHeightM;
    parts.push(
      columnPart(context, {
        x: centerX,
        y: heightMeters,
        z: centerZ,
        radius: radius * 0.85,
        height: mosqueDrumHeightM,
        kind: trimKind,
        segments: 10,
      }),
      domePart(context, { x: centerX, y: domeY, z: centerZ, radius, kind: roofKind }),
      columnPart(context, {
        x: centerX,
        y: domeY + radius,
        z: centerZ,
        radius: 0.12,
        height: 1.6,
        kind: trimKind,
        segments: 5,
      }),
    );
  }
  parts.push(...cornerDomes(context, radius), ...minaret(context));
  return parts;
}

function cornerDomes(context: PartContext, mainRadius: number) {
  const { outline, heightMeters } = context.footprint;
  const box = boxyBox(outline);
  if (!box || box.short < mainRadius * 1.8) {
    return [];
  }
  const radius = mainRadius * 0.32;
  const reachLong = box.long - radius * 1.3;
  const reachShort = box.short - radius * 1.3;
  return [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ].flatMap(([alongSign, acrossSign]) => {
    const point = boxPoint(box, alongSign * reachLong, acrossSign * reachShort, heightMeters);
    return polygonContains(outline, point.x, point.z)
      ? [domePart(context, { x: point.x, y: heightMeters, z: point.z, radius, kind: roofKind })]
      : [];
  });
}

function minaret(context: PartContext) {
  const { outline, heightMeters } = context.footprint;
  const [x, z] = cornerOf(outline, 1);
  const shaftHeight = Math.max(heightMeters * 1.8, heightMeters + minaretMinRiseM);
  return [
    columnPart(context, {
      x,
      y: 0,
      z,
      radius: minaretRadiusM,
      height: shaftHeight,
      kind: trimKind,
    }),
    columnPart(context, {
      x,
      y: shaftHeight * 0.78,
      z,
      radius: minaretRadiusM * 1.6,
      height: 0.35,
      kind: trimKind,
    }),
    conePart(context, {
      x,
      y: shaftHeight,
      z,
      radius: minaretRadiusM * 1.35,
      height: 2.2,
      kind: roofKind,
    }),
    columnPart(context, {
      x,
      y: shaftHeight + 2.2,
      z,
      radius: 0.08,
      height: 1.2,
      kind: trimKind,
      segments: 4,
    }),
  ];
}

export function schoolParts(context: PartContext) {
  const { outline, heightMeters } = context.footprint;
  const [x, z] = cornerOf(outline, 0.6);
  return [
    extrudeFootprint(context, heightMeters),
    columnPart(context, {
      ...flagpole,
      x,
      y: heightMeters,
      z,
      kind: trimKind,
      segments: 4,
    }),
  ];
}

export function hospitalParts(context: PartContext) {
  const { outline, heightMeters } = context.footprint;
  const parts = [extrudeFootprint(context, heightMeters)];
  const [centerX, centerZ] = centerOf(outline);
  if (!polygonContains(outline, centerX, centerZ)) {
    return parts;
  }
  const arm = clamp(Math.sqrt(polygonArea(outline)) * 0.28, 3, 7);
  const thickness = arm / 3;
  const box = orientedBox(outline);
  const turn = box ? Math.atan2(-box.axis[1], box.axis[0]) : 0;
  const spot = { x: centerX, y: heightMeters - 0.05, z: centerZ, kind: glowKind, turn };
  parts.push(
    boxPart(context, { ...spot, width: thickness, height: arm, depth: crossDepthM }),
    boxPart(context, {
      ...spot,
      y: spot.y + (arm - thickness) / 2,
      width: arm,
      height: thickness,
      depth: crossDepthM,
    }),
  );
  return parts;
}

function sawtoothRoof(context: PartContext, box: OrientedBox, baseY: number) {
  const long = box.long - 0.2;
  const short = box.short - 0.2;
  const count = Math.max(1, Math.round((long * 2) / sawtoothToothWidthM));
  const width = (long * 2) / count;
  const topY = baseY + sawtoothRiseM;
  const facets: Facet[] = [];
  for (let tooth = 0; tooth < count; tooth += 1) {
    const start = -long + tooth * width;
    const end = start + width;
    const inside = boxPoint(box, (start + end) / 2, 0, baseY - 0.5);
    const startLow = boxPoint(box, start, -short, baseY);
    const startLowFar = boxPoint(box, start, short, baseY);
    const startHighFar = boxPoint(box, start, short, topY);
    const startHigh = boxPoint(box, start, -short, topY);
    const endLow = boxPoint(box, end, -short, baseY);
    const endLowFar = boxPoint(box, end, short, baseY);
    facets.push(
      [startLow, startLowFar, startHighFar, inside],
      [startLow, startHighFar, startHigh, inside],
      [startHigh, startHighFar, endLowFar, inside],
      [startHigh, endLowFar, endLow, inside],
      [startLow, startHigh, endLow, inside],
      [startLowFar, endLowFar, startHighFar, inside],
    );
  }
  const geometry = facetGeometry(facets);
  addFacadeAttributes(geometry, context.footprint, roofKind, context.share);
  return geometry;
}

export function industrialParts(context: PartContext) {
  const { footprint } = context;
  const { outline, heightMeters } = footprint;
  const parts = [extrudeFootprint(context, heightMeters)];
  const box = boxyBox(outline);
  if (box) {
    parts.push(sawtoothRoof(context, box, heightMeters));
  }
  if (hashOf(footprint, 5.3) < chimneyShare) {
    const [x, z] = cornerOf(outline, 1.2);
    parts.push(
      columnPart(context, {
        x,
        y: 0,
        z,
        radius: 0.8,
        height: heightMeters + chimneyRiseM,
        kind: trimKind,
      }),
    );
  }
  return parts;
}

export function genericParts(context: PartContext) {
  const { outline, heightMeters } = context.footprint;
  const parts = [extrudeFootprint(context, heightMeters)];
  const area = polygonArea(outline);
  const [centerX, centerZ] = centerOf(outline);
  if (
    heightMeters >= roofBoxMinHeightM &&
    area >= roofBoxMinAreaM2 &&
    polygonContains(outline, centerX, centerZ)
  ) {
    const side = Math.min(4, Math.sqrt(area) * 0.25);
    parts.push(
      boxPart(context, {
        x: centerX,
        y: heightMeters - trimMeters,
        z: centerZ,
        width: side,
        height: roofBoxHeightM,
        depth: side,
        kind: trimKind,
      }),
    );
  }
  return parts;
}
