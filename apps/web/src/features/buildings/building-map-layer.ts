import type { CustomLayerInterface, Map as MapLibreMap } from "maplibre-gl";

import * as THREE from "three";

import type { BuildingPalette } from "@/lib/building-palette";

import { loadFootprints, type TileData } from "@/features/bowls/building-footprints";
import { buildBuildingGeometry } from "@/features/buildings/building-geometry";
import { buildingColorGlsl, buildingUniformsGlsl } from "@/features/buildings/building-shader";
import { buildSceneryGeometry } from "@/features/buildings/scenery-geometry";

const minZoom = 16.5;
const regionHalfSizeM = 1000;
const reloadDistanceM = 300;
const maxOriginDistanceM = 8000;
const earthCircumferenceM = 40_075_017;
const metersPerDegree = 111_320;
const attributeNames = ["position", "normal", "grid", "kind", "tint"] as const;
const attributeSizes = [3, 3, 2, 1, 2];

const vertexSource = `#version 300 es
in vec3 aPosition;
in vec3 aNormal;
in vec2 aGrid;
in float aKind;
in vec2 aTint;
uniform mat4 uMatrix;
out vec2 vGrid;
out float vKind;
out vec2 vTint;
out vec3 vFaceNormal;
void main() {
  vGrid = aGrid;
  vKind = aKind;
  vTint = aTint;
  vFaceNormal = aNormal;
  gl_Position = uMatrix * vec4(aPosition, 1.0);
}`;

const fragmentSource = `#version 300 es
precision highp float;
${buildingUniformsGlsl}
in vec2 vGrid;
in float vKind;
in vec2 vTint;
in vec3 vFaceNormal;
out vec4 outColor;
${buildingColorGlsl}
vec3 toSrgb(vec3 linear) {
  vec3 high = pow(linear, vec3(1.0 / 2.4)) * 1.055 - 0.055;
  return mix(high, linear * 12.92, step(linear, vec3(0.0031308)));
}
void main() {
  outColor = vec4(toSrgb(buildingColor(vGrid, vKind, vTint, vFaceNormal)), 1.0);
}`;

type Mesh = {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  vertexCount: number;
};

function linearColor(hex: string) {
  return new THREE.Color().set(hex).toArray();
}

function flatten(hexes: string[]) {
  return new Float32Array(hexes.flatMap(linearColor));
}

function mercatorOf(lng: number, lat: number) {
  const sine = Math.sin((lat * Math.PI) / 180);
  return {
    x: (lng + 180) / 360,
    y: 0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI),
  };
}

// Maps local meters (x east, y up, z south) to mercator world units around `origin`.
function modelMatrix(origin: [number, number]) {
  const { x, y } = mercatorOf(origin[0], origin[1]);
  const scale = 1 / (earthCircumferenceM * Math.cos((origin[1] * Math.PI) / 180));
  // prettier-ignore
  return [
    scale, 0, 0, 0,
    0, 0, scale, 0,
    0, scale, 0, 0,
    x, y, 0, 1,
  ];
}

function multiply(left: ArrayLike<number>, right: number[]) {
  const out = Array.from({ length: 16 }, () => 0);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      for (let step = 0; step < 4; step += 1) {
        out[column * 4 + row] += left[step * 4 + row] * right[column * 4 + step];
      }
    }
  }
  return out;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext) {
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
  ["aPosition", "aNormal", "aGrid", "aKind", "aTint"].forEach((name, index) =>
    gl.bindAttribLocation(program, index, name),
  );
  gl.linkProgram(program);
  return program;
}

function uploadMesh(gl: WebGL2RenderingContext, geometry: THREE.BufferGeometry): Mesh {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  const buffers = attributeNames.map((name, index) => {
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.attributes[name].array as Float32Array, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, attributeSizes[index], gl.FLOAT, false, 0, 0);
    return buffer;
  });
  gl.bindVertexArray(null);
  return { vao, buffers, vertexCount: geometry.attributes.position.count };
}

function disposeMesh(gl: WebGL2RenderingContext, mesh: Mesh) {
  gl.deleteVertexArray(mesh.vao);
  mesh.buffers.forEach((buffer) => gl.deleteBuffer(buffer));
}

// Tiles load relative to their own center. Shifting them onto one fixed origin keeps window grids, hues and road dashes stable across reloads.
function shiftTileData(
  data: TileData,
  origin: [number, number],
  center: [number, number],
): TileData {
  const from = mercatorOf(origin[0], origin[1]);
  const to = mercatorOf(center[0], center[1]);
  const metersPerUnit = earthCircumferenceM * Math.cos((origin[1] * Math.PI) / 180);
  const east = (to.x - from.x) * metersPerUnit;
  const south = (to.y - from.y) * metersPerUnit;
  const shift = ([x, z]: [number, number]): [number, number] => [x + east, z + south];
  return {
    footprints: data.footprints.map((footprint) => ({
      ...footprint,
      outline: footprint.outline.map(shift),
      holes: footprint.holes.map((hole) => hole.map(shift)),
    })),
    parks: data.parks.map((park) => ({
      outline: park.outline.map(shift),
      holes: park.holes.map((hole) => hole.map(shift)),
    })),
    roads: data.roads.map((road) => ({ ...road, line: road.line.map(shift) })),
  };
}

function metersBetween(from: [number, number], to: [number, number]) {
  const east = (to[0] - from[0]) * metersPerDegree * Math.cos((from[1] * Math.PI) / 180);
  const north = (to[1] - from[1]) * metersPerDegree;
  return Math.hypot(east, north);
}

// Draws footprints with the same shader as the bowl scene. Mercator only: it skips drawing while the globe is blended in.
export function createBuildingLayer(
  id: string,
  palette: BuildingPalette,
  flatLayerIds: string[],
): CustomLayerInterface {
  let map: MapLibreMap;
  let areFlatLayersVisible = true;
  let gl: WebGL2RenderingContext;
  let program: WebGLProgram;
  let meshes: Mesh[] = [];
  let origin: [number, number] | null = null;
  let matrix: number[] = [];
  let loadedCenter: [number, number] | null = null;
  let controller: AbortController | null = null;
  const uniforms: Record<string, Float32Array> = {
    uWalls: flatten(palette.walls),
    uRoofs: flatten(palette.roofs),
    uTypeWalls: flatten(palette.typeWalls),
    uTypeRoofs: flatten(palette.typeRoofs),
    uTrim: new Float32Array(linearColor(palette.trim)),
    uWindow: new Float32Array(linearColor(palette.window)),
    uWindowAlt: new Float32Array(linearColor(palette.windowAlt)),
    uLit: new Float32Array(linearColor(palette.lit)),
    uPark: new Float32Array(linearColor(palette.park)),
    uCanopy: new Float32Array(linearColor(palette.canopy)),
    uCanopyAlt: new Float32Array(linearColor(palette.canopyAlt)),
    uTrunk: new Float32Array(linearColor(palette.trunk)),
    uRoad: new Float32Array(linearColor(palette.road)),
    uSidewalk: new Float32Array(linearColor(palette.sidewalk)),
    uMarking: new Float32Array(linearColor(palette.marking)),
  };

  function showFlatLayers(isVisible: boolean) {
    if (isVisible === areFlatLayersVisible) {
      return;
    }
    areFlatLayersVisible = isVisible;
    for (const layerId of flatLayerIds) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", isVisible ? "visible" : "none");
      }
    }
  }

  function syncFlatLayers() {
    showFlatLayers(meshes.length === 0 || map.getZoom() < minZoom);
  }

  function refresh() {
    if (map.getZoom() < minZoom) {
      return;
    }
    const { lng, lat } = map.getCenter();
    const center: [number, number] = [lng, lat];
    if (loadedCenter && metersBetween(loadedCenter, center) < reloadDistanceM) {
      return;
    }
    controller?.abort();
    const request = new AbortController();
    controller = request;
    const meshOrigin =
      origin && metersBetween(origin, center) < maxOriginDistanceM ? origin : center;
    loadFootprints(center, regionHalfSizeM, request.signal)
      .then((data) => {
        if (request.signal.aborted) {
          return;
        }
        const shifted = shiftTileData(data, meshOrigin, center);
        const geometries = [
          buildSceneryGeometry(shifted),
          buildBuildingGeometry(shifted.footprints),
        ].filter((geometry) => geometry !== null);
        const next = geometries.map((geometry) => {
          const uploaded = uploadMesh(gl, geometry);
          geometry.dispose();
          return uploaded;
        });
        meshes.forEach((mesh) => disposeMesh(gl, mesh));
        meshes = next;
        origin = meshOrigin;
        matrix = modelMatrix(meshOrigin);
        loadedCenter = center;
        syncFlatLayers();
        map.triggerRepaint();
      })
      .catch(() => {});
  }

  return {
    id,
    type: "custom",
    renderingMode: "3d",
    onAdd(addedMap, context) {
      map = addedMap;
      gl = context;
      program = createProgram(gl);
      map.on("moveend", refresh);
      map.on("zoom", syncFlatLayers);
      refresh();
    },
    onRemove() {
      map.off("moveend", refresh);
      map.off("zoom", syncFlatLayers);
      showFlatLayers(true);
      controller?.abort();
      meshes.forEach((mesh) => disposeMesh(gl, mesh));
      gl.deleteProgram(program);
    },
    render(_context, args) {
      const projection = args.defaultProjectionData;
      if (
        meshes.length === 0 ||
        map.getZoom() < minZoom ||
        projection.projectionTransition > 0.01
      ) {
        return;
      }
      const projected = multiply(projection.mainMatrix, matrix);
      gl.useProgram(program);
      gl.uniformMatrix4fv(
        gl.getUniformLocation(program, "uMatrix"),
        false,
        new Float32Array(projected),
      );
      for (const [name, value] of Object.entries(uniforms)) {
        gl.uniform3fv(gl.getUniformLocation(program, name), value);
      }
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.disable(gl.BLEND);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-2, -2);
      for (const mesh of meshes) {
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.vertexCount);
      }
      gl.bindVertexArray(null);
      gl.disable(gl.POLYGON_OFFSET_FILL);
    },
  };
}
