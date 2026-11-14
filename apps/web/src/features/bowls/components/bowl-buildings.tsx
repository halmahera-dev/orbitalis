"use client";

import { useCursor } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { depthShareAt } from "@/features/bowls/bowl-shape";
import { loadFootprints, type TileData } from "@/features/bowls/building-footprints";
import { buildBuildingGeometry } from "@/features/buildings/building-geometry";
import { buildingColorGlsl, buildingUniformsGlsl } from "@/features/buildings/building-shader";
import { accentTypeCount, paletteSize } from "@/features/buildings/building-types";
import { buildSceneryGeometry } from "@/features/buildings/scenery-geometry";
import { buildingPalette } from "@/lib/building-palette";

type FacadeUniforms = {
  uWalls: { value: THREE.Color[] };
  uRoofs: { value: THREE.Color[] };
  uTypeWalls: { value: THREE.Color[] };
  uTypeRoofs: { value: THREE.Color[] };
  uTrim: { value: THREE.Color };
  uWindow: { value: THREE.Color };
  uWindowAlt: { value: THREE.Color };
  uLit: { value: THREE.Color };
  uPark: { value: THREE.Color };
  uCanopy: { value: THREE.Color };
  uCanopyAlt: { value: THREE.Color };
  uTrunk: { value: THREE.Color };
  uRoad: { value: THREE.Color };
  uSidewalk: { value: THREE.Color };
  uMarking: { value: THREE.Color };
  uBrand: { value: THREE.Color };
  uSelected: { value: number };
};

function createFacadeMaterial() {
  const uniforms: FacadeUniforms = {
    uWalls: { value: Array.from({ length: paletteSize }, () => new THREE.Color()) },
    uRoofs: { value: Array.from({ length: paletteSize }, () => new THREE.Color()) },
    uTypeWalls: { value: Array.from({ length: accentTypeCount }, () => new THREE.Color()) },
    uTypeRoofs: { value: Array.from({ length: accentTypeCount }, () => new THREE.Color()) },
    uTrim: { value: new THREE.Color() },
    uWindow: { value: new THREE.Color() },
    uWindowAlt: { value: new THREE.Color() },
    uLit: { value: new THREE.Color() },
    uPark: { value: new THREE.Color() },
    uCanopy: { value: new THREE.Color() },
    uCanopyAlt: { value: new THREE.Color() },
    uTrunk: { value: new THREE.Color() },
    uRoad: { value: new THREE.Color() },
    uSidewalk: { value: new THREE.Color() },
    uMarking: { value: new THREE.Color() },
    uBrand: { value: new THREE.Color() },
    uSelected: { value: 0 },
  };
  const material = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  material.customProgramCacheKey = () => "bowl-buildings-shared";
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec2 grid;
attribute float kind;
attribute vec2 tint;
varying vec2 vGrid;
varying float vKind;
varying vec2 vTint;
varying vec3 vFaceNormal;`,
      )
      .replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>
vGrid = grid;
vKind = kind;
vTint = tint;
vFaceNormal = normal;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
${buildingUniformsGlsl}
uniform vec3 uBrand;
uniform float uSelected;
varying vec2 vGrid;
varying float vKind;
varying vec2 vTint;
varying vec3 vFaceNormal;
${buildingColorGlsl}`,
      )
      .replace(
        "#include <color_fragment>",
        `diffuseColor.rgb = mix(buildingColor(vGrid, vKind, vTint, vFaceNormal), uBrand, uSelected * 0.28);`,
      );
  };
  material.userData.uniforms = uniforms;
  return material;
}

function FacadeMaterial({
  isDark,
  brand,
  selected,
  clipPlanes,
}: {
  isDark: boolean;
  brand: THREE.Color;
  selected: boolean;
  clipPlanes: THREE.Plane[];
}) {
  const invalidate = useThree((state) => state.invalidate);
  const material = useMemo(() => createFacadeMaterial(), []);

  useLayoutEffect(() => {
    const uniforms = material.userData.uniforms as FacadeUniforms;
    const palette = buildingPalette();
    palette.walls.forEach((hex, index) => uniforms.uWalls.value[index].set(hex));
    palette.roofs.forEach((hex, index) => uniforms.uRoofs.value[index].set(hex));
    palette.typeWalls.forEach((hex, index) => uniforms.uTypeWalls.value[index].set(hex));
    palette.typeRoofs.forEach((hex, index) => uniforms.uTypeRoofs.value[index].set(hex));
    uniforms.uTrim.value.set(palette.trim);
    uniforms.uWindow.value.set(palette.window);
    uniforms.uWindowAlt.value.set(palette.windowAlt);
    uniforms.uLit.value.set(palette.lit);
    uniforms.uPark.value.set(palette.park);
    uniforms.uCanopy.value.set(palette.canopy);
    uniforms.uCanopyAlt.value.set(palette.canopyAlt);
    uniforms.uTrunk.value.set(palette.trunk);
    uniforms.uRoad.value.set(palette.road);
    uniforms.uSidewalk.value.set(palette.sidewalk);
    uniforms.uMarking.value.set(palette.marking);
    uniforms.uBrand.value.copy(brand);
    uniforms.uSelected.value = selected ? 1 : 0;
    material.clippingPlanes = clipPlanes;
    invalidate();
  }, [material, isDark, brand, selected, clipPlanes, invalidate]);

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  return <primitive object={material} attach="material" />;
}

function useFloorFollowing(geometry: THREE.BufferGeometry | null, floorY: number) {
  const invalidate = useThree((state) => state.invalidate);
  const restHeights = useMemo(() => {
    const positions = geometry?.attributes.position;
    return positions
      ? Float32Array.from({ length: positions.count }, (_, i) => positions.getY(i))
      : null;
  }, [geometry]);

  useLayoutEffect(() => {
    if (!geometry || !restHeights) {
      return;
    }
    const positions = geometry.attributes.position;
    const shares = geometry.attributes.share;
    for (let index = 0; index < positions.count; index += 1) {
      positions.setY(index, restHeights[index] + floorY * shares.getX(index));
    }
    positions.needsUpdate = true;
    geometry.computeBoundingSphere();
    invalidate();
  }, [geometry, restHeights, floorY, invalidate]);

  useEffect(() => {
    return () => geometry?.dispose();
  }, [geometry]);
}

export function BowlBuildings({
  center,
  radiusM,
  halfSize,
  floorY,
  showBuildings,
  showScenery,
  isDark,
  brand,
  selected,
  clipPlanes,
  onSelect,
}: {
  center: [number, number];
  radiusM: number;
  halfSize: number;
  floorY: number;
  showBuildings: boolean;
  showScenery: boolean;
  isDark: boolean;
  brand: THREE.Color;
  selected: boolean;
  clipPlanes: THREE.Plane[];
  onSelect: (event: ThreeEvent<MouseEvent>) => void;
}) {
  const [tileData, setTileData] = useState<TileData | null>(null);
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);

  useEffect(() => {
    const controller = new AbortController();
    loadFootprints(center, halfSize, controller.signal)
      .then(setTileData)
      .catch(() => {});
    return () => controller.abort();
  }, [center, halfSize]);

  const buildings = useMemo(() => {
    if (!tileData) {
      return null;
    }
    return buildBuildingGeometry(tileData.footprints, (footprint) => {
      const [firstX, firstZ] = footprint.outline[0];
      return depthShareAt(Math.hypot(firstX, firstZ), radiusM);
    });
  }, [tileData, radiusM]);

  const scenery = useMemo(() => {
    if (!tileData) {
      return null;
    }
    return buildSceneryGeometry(tileData, (x, z) => depthShareAt(Math.hypot(x, z), radiusM));
  }, [tileData, radiusM]);

  useFloorFollowing(buildings, floorY);
  useFloorFollowing(scenery, floorY);

  return (
    <>
      {scenery && showScenery ? (
        <mesh geometry={scenery}>
          <FacadeMaterial isDark={isDark} brand={brand} selected={false} clipPlanes={clipPlanes} />
        </mesh>
      ) : null}
      {buildings && showBuildings ? (
        <mesh
          geometry={buildings}
          onClick={onSelect}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <FacadeMaterial
            isDark={isDark}
            brand={brand}
            selected={selected}
            clipPlanes={clipPlanes}
          />
        </mesh>
      ) : null}
    </>
  );
}
