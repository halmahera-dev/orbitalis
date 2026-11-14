import { accentTypeCount, buildingTypes, paletteSize } from "@/features/buildings/building-types";

function typeNumber(name: (typeof buildingTypes)[number]) {
  return `${buildingTypes.indexOf(name)}.0`;
}

// One floor of windows: a repeating cell and the pane inside it, per building type, in meters.
const glassCells = {
  generic: { cell: [3.6, 3.4], pane: [2.1, 1.7] },
  house: { cell: [6.0, 3.4], pane: [1.2, 1.3] },
  worship: { cell: [4.2, 4.4], pane: [1.5, 2.8] },
  school: { cell: [3.0, 3.4], pane: [2.6, 1.3] },
};
const litThreshold = 0.734;

function vec2(values: number[]) {
  return `vec2(${values.map((value) => value.toFixed(1)).join(", ")})`;
}

// Constant indices only: dynamic uniform-array indexing is unreliable on some GPU drivers.
function pickByIndex(uniformArray: string, count: number, indexVariable: string) {
  return Array.from({ length: count - 1 }, (_, offset) => offset + 1).reduce(
    (expression, index) =>
      `mix(${expression}, ${uniformArray}[${index}], step(${index - 0.5}, ${indexVariable}))`,
    `${uniformArray}[0]`,
  );
}

export const buildingUniformsGlsl = `
uniform vec3 uWalls[${paletteSize}];
uniform vec3 uRoofs[${paletteSize}];
uniform vec3 uTypeWalls[${accentTypeCount}];
uniform vec3 uTypeRoofs[${accentTypeCount}];
uniform vec3 uTrim;
uniform vec3 uWindow;
uniform vec3 uWindowAlt;
uniform vec3 uLit;
uniform vec3 uPark;
uniform vec3 uCanopy;
uniform vec3 uCanopyAlt;
uniform vec3 uTrunk;
uniform vec3 uRoad;
uniform vec3 uSidewalk;
uniform vec3 uMarking;
`;

export const buildingColorGlsl = `
float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float isType(float type, float index) {
  return 1.0 - step(0.5, abs(type - index));
}

vec3 facadeColor(vec2 vGrid, float vKind, vec2 vTint, vec3 vFaceNormal) {
  float type = floor(vTint.x / ${paletteSize}.0 + 0.001);
  float slot = vTint.x - type * ${paletteSize}.0;
  float typeSlot = max(type - 1.0, 0.0);
  float isTyped = step(0.5, type);
  float isHouse = isType(type, ${typeNumber("house")});
  float isWorship = isType(type, ${typeNumber("worship")});
  float isSchool = isType(type, ${typeNumber("school")});
  float isIndustrial = isType(type, ${typeNumber("industrial")});
  float windowed = 1.0 - isIndustrial;

  vec2 cell = ${vec2(glassCells.generic.cell)};
  cell = mix(cell, ${vec2(glassCells.house.cell)}, isHouse);
  cell = mix(cell, ${vec2(glassCells.worship.cell)}, isWorship);
  cell = mix(cell, ${vec2(glassCells.school.cell)}, isSchool);
  vec2 pane = ${vec2(glassCells.generic.pane)};
  pane = mix(pane, ${vec2(glassCells.house.pane)}, isHouse);
  pane = mix(pane, ${vec2(glassCells.worship.pane)}, isWorship);
  pane = mix(pane, ${vec2(glassCells.school.pane)}, isSchool);

  vec2 inset = (cell - pane) * 0.5;
  vec2 id = floor(vGrid / cell);
  vec2 local = mod(vGrid, cell);
  vec2 inPaneUv = (local - inset) / pane;
  float inPane = step(0.0, inPaneUv.x) * step(inPaneUv.x, 1.0) * step(0.0, inPaneUv.y) * step(inPaneUv.y, 1.0);
  float sill = step(inset.y - 0.2, local.y) * step(local.y, inset.y)
    * step(inset.x - 0.15, local.x) * step(local.x, inset.x + pane.x + 0.15);
  float cellPixels = cell.x / max(max(fwidth(vGrid.x), fwidth(vGrid.y)), 0.0001);
  float detail = smoothstep(3.0, 8.0, cellPixels);

  float doorCell = isHouse * step(0.72, hash21(id * 3.7 + 11.0)) * (1.0 - step(0.5, id.y));
  float present = mix(1.0, step(0.3, hash21(id * 2.3 + 7.0)), isHouse) * (1.0 - doorCell);
  vec2 fromBase = (inPaneUv - vec2(0.5, 0.0)) * pane;
  float archRadius = pane.x * 0.5;
  float archBase = pane.y - archRadius;
  float arch = max(step(fromBase.y, archBase), step(length(vec2(fromBase.x, fromBase.y - archBase)), archRadius));
  inPane *= mix(1.0, arch, isWorship) * present * detail * windowed;
  sill *= present * detail * windowed;
  float door = doorCell * step(abs(local.x - cell.x * 0.5), 0.55) * step(local.y, 2.1) * detail;

  float isRoof = step(0.5, vKind) * (1.0 - step(1.5, vKind));
  float isTrim = step(1.5, vKind) * (1.0 - step(2.5, vKind));
  float isWall = 1.0 - step(0.5, vKind);

  float sloped = 1.0 - step(0.995, normalize(vFaceNormal).y);
  float accentRoof = isTyped * max(1.0 - max(isHouse, isWorship), sloped);
  vec3 wall = mix(${pickByIndex("uWalls", paletteSize, "slot")}, ${pickByIndex("uTypeWalls", accentTypeCount, "typeSlot")}, isTyped);
  vec3 roof = mix(${pickByIndex("uRoofs", paletteSize, "slot")}, ${pickByIndex("uTypeRoofs", accentTypeCount, "typeSlot")}, accentRoof);
  float tileRowPixels = 0.5 / max(fwidth(vGrid.y), 0.0001);
  float tileRow = mix(0.8, 1.0, smoothstep(0.0, 0.2, fract(vGrid.y / 0.5)));
  roof *= mix(1.0, tileRow, isHouse * sloped * smoothstep(3.0, 8.0, tileRowPixels));

  vec3 glass = mix(uWindow, uWindowAlt, hash21(id + vTint.y * 57.0));
  glass = mix(glass * 0.8, glass, inPaneUv.y);
  vec3 facade = mix(wall, uTrim, sill * 0.85);
  facade = mix(facade, glass, inPane);
  facade = mix(facade, wall * 0.45, door);
  facade = mix(mix(wall, glass, 0.3 * windowed * mix(1.0, 0.35, isHouse)), facade, detail);

  vec3 styled = mix(facade, roof, isRoof);
  styled = mix(styled, uTrim, isTrim);

  vec3 faceNormal = normalize(vFaceNormal);
  float sunFace = smoothstep(-0.1, 0.5, dot(faceNormal, normalize(vec3(0.55, 0.65, 0.5))));
  vec3 shade = mix(vec3(0.72, 0.77, 0.92), vec3(1.0), sunFace);
  shade *= mix(1.0, mix(0.8, 1.0, smoothstep(0.0, 6.0, vGrid.y)), isWall);
  styled *= shade;

  float isLit = step(${litThreshold}, hash21(id * 1.7 + vTint.y * 91.0 + 3.0)) * inPane * isWall;
  return mix(styled, uLit, isLit);
}

vec3 sceneryColor(vec2 vGrid, float vKind, vec2 vTint, vec3 vFaceNormal) {
  float isPark = 1.0 - step(0.5, abs(vKind - 3.0));
  float isRoad = 1.0 - step(0.5, abs(vKind - 4.0));
  float isCanopy = 1.0 - step(0.5, abs(vKind - 5.0));
  float isTrunk = 1.0 - step(0.5, abs(vKind - 6.0));
  float isGlow = 1.0 - step(0.5, abs(vKind - 7.0));

  vec3 park = mix(uPark, uPark * 1.14, step(0.5, hash21(floor(vGrid / 7.0))));

  float edge = max(fwidth(vGrid.x), 0.0001);
  float sidewalk = smoothstep(vTint.x - 1.2 - edge, vTint.x - 1.2 + edge, abs(vGrid.x));
  float dash = step(abs(vGrid.x), 0.12) * step(fract(vGrid.y / 8.0), 0.5) * vTint.y;
  vec3 road = mix(uRoad, uSidewalk, sidewalk);
  road = mix(road, uMarking, dash);

  vec3 canopy = mix(uCanopy, uCanopyAlt, vTint.y);

  vec3 ground = mix(park, road, isRoad);
  vec3 plant = mix(canopy, uTrunk, isTrunk);
  vec3 styled = mix(ground, plant, step(4.5, vKind));

  vec3 faceNormal = normalize(vFaceNormal);
  float sunFace = smoothstep(-0.1, 0.5, dot(faceNormal, normalize(vec3(0.55, 0.65, 0.5))));
  styled *= mix(vec3(0.72, 0.77, 0.92), vec3(1.0), sunFace);
  return mix(styled, uLit, isGlow);
}

vec3 buildingColor(vec2 vGrid, float vKind, vec2 vTint, vec3 vFaceNormal) {
  vec3 facade = facadeColor(vGrid, vKind, vTint, vFaceNormal);
  vec3 scenery = sceneryColor(vGrid, vKind, vTint, vFaceNormal);
  return mix(facade, scenery, step(2.5, vKind));
}
`;
