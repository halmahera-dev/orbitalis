"use client";

import { CameraControls, Line } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

type SceneBowl = { center: [number, number]; radiusM: number; rateMmYr: number };

import {
  blockHalfSize,
  blockThickness,
  bowlSpread,
  contourRings,
  layerTopY,
  soilLayers,
  wellOffsetM,
  type SoilLayerId,
} from "@/features/bowls/bowl-shape";
import { BowlBuildings } from "@/features/bowls/components/bowl-buildings";
import { useOrbitGestures } from "@/features/bowls/components/use-orbit-gestures";
import { useRubberBand } from "@/features/bowls/components/use-rubber-band";
import { fastRateMmYr, middleRateMmYr, slowRateMmYr } from "@/features/map/bowl-rates";
import { resolveColor } from "@/lib/dither";

export type SceneView = "overview" | "cutaway" | "street";
export type SceneLayers = {
  buildings: boolean;
  scenery: boolean;
  contours: boolean;
  banGrid: boolean;
  rate: boolean;
  sea: boolean;
  labels: boolean;
};
export type ScenePart = "center" | "edge" | "house" | "clay" | "well" | "sea" | "radar" | "block";

export type SceneLabels = {
  layers: Record<SoilLayerId, string>;
  well: string;
  pressure: string;
  highTide: string;
};

type SceneColors = {
  water: THREE.Color;
  ground: THREE.Color;
  line: THREE.Color;
  house: THREE.Color;
  rate: THREE.Color;
  brand: THREE.Color;
  isDark: boolean;
  layers: Record<SoilLayerId, THREE.Color>;
};

type Shape = ReturnType<typeof bowlShape>;
type Vector = [number, number, number];

const surfaceSegments = 96;
const ringSegments = 96;
const cutSettleSeconds = 0.12;
const cameraSmoothSeconds = 0.4;
const cameraDragSmoothSeconds = 0.04;
const clickMoveLimitPx = 4;
const streetEyeMeters = 80;
const streetStandMeters = 240;
const clayLayerIds: SoilLayerId[] = ["softClay", "stiffClay"];
const pickedClayTint = 0.35;
const faceOffset = 1;
const sweepMilliseconds = 1400;
const sweepOpacity = 0.4;
const ghostSegments = 64;
const ghostReach = 1.7;
const ghostFadeRate = 3;
const labelEdgeMargin = 8;
const sceneFov = 35;
const overviewMargin = 1;
const overviewDirection = new THREE.Vector3(2.15, 1.5, 2.25).normalize();
const startViewport = { width: 1600, height: 1000 };

function readColor(css: string) {
  const [red, green, blue] = resolveColor(css);
  return new THREE.Color().setRGB(red, green, blue, THREE.SRGBColorSpace);
}

function rateColor(rateMmYr: number) {
  const slow = readColor("--rate-slow");
  const middle = readColor("--rate-middle");
  const fast = readColor("--rate-fast");
  if (rateMmYr <= middleRateMmYr) {
    const share = (rateMmYr - slowRateMmYr) / (middleRateMmYr - slowRateMmYr);
    return slow.lerp(middle, THREE.MathUtils.clamp(share, 0, 1));
  }
  const share = (rateMmYr - middleRateMmYr) / (fastRateMmYr - middleRateMmYr);
  return middle.lerp(fast, THREE.MathUtils.clamp(share, 0, 1));
}

function readSceneColors(rateMmYr: number): SceneColors {
  const isDark = document.documentElement.classList.contains("dark");
  return {
    water: readColor("--chart-2"),
    ground: readColor("color-mix(in srgb, var(--muted-foreground) 22%, var(--background))"),
    line: readColor("--foreground"),
    house: readColor("color-mix(in srgb, var(--foreground) 70%, var(--background))"),
    rate: rateColor(rateMmYr),
    brand: readColor("--brand"),
    isDark,
    layers: {
      fill: readColor("color-mix(in srgb, var(--muted-foreground) 35%, var(--background))"),
      softClay: readColor("color-mix(in srgb, var(--chart-3) 45%, var(--background))"),
      sand: readColor("color-mix(in srgb, var(--chart-3) 20%, var(--background))"),
      stiffClay: readColor("color-mix(in srgb, var(--chart-3) 55%, var(--muted-foreground))"),
      aquifer: readColor("color-mix(in srgb, var(--chart-5) 40%, var(--background))"),
    },
  };
}

function useSceneColors(rateMmYr: number) {
  const [colors, setColors] = useState<SceneColors | null>(null);

  useEffect(() => {
    function read() {
      setColors(readSceneColors(rateMmYr));
    }
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    return () => {
      observer.disconnect();
    };
  }, [rateMmYr]);

  return colors;
}

function bowlShape(radiusM: number, deepestDropY: number, seaDepthY: number) {
  const halfSize = blockHalfSize(radiusM);
  const spread = bowlSpread(radiusM);
  const thickness = blockThickness(radiusM, deepestDropY, seaDepthY);
  return {
    radiusM,
    halfSize,
    thickness,
    seaY: -seaDepthY,
    frame: Math.max(halfSize, thickness * 0.9),
    wellX: wellOffsetM(radiusM),
    share: (x: number, z: number) => Math.exp(-(x * x + z * z) / (spread * spread)),
  };
}

function layerMiddleY(layerIndex: number, shape: Shape, surfaceDropY: number) {
  const top = layerTopY(layerIndex, shape.thickness, surfaceDropY);
  const bottom =
    layerIndex + 1 < soilLayers.length
      ? layerTopY(layerIndex + 1, shape.thickness, surfaceDropY)
      : -shape.thickness;
  return (top + bottom) / 2;
}

function layerIndexOf(id: SoilLayerId) {
  return soilLayers.findIndex((layer) => layer.id === id);
}

function wellSpan(shape: Shape, floorY: number) {
  const aquiferIndex = layerIndexOf("aquifer");
  return {
    top: floorY * shape.share(shape.wellX, 0),
    bottom: layerMiddleY(aquiferIndex, shape, 0),
  };
}

export type SceneInsets = { top: number; bottom: number; left: number; right: number };

type Viewport = SceneInsets & { width: number; height: number };

function fitDistance(radius: number, viewport: Viewport) {
  const halfFov = THREE.MathUtils.degToRad(sceneFov) / 2;
  const visibleHeight = Math.max(viewport.height - viewport.top - viewport.bottom, 1);
  const visibleWidth = Math.max(viewport.width - viewport.left - viewport.right, 1);
  const halfVisibleVertical = Math.atan((Math.tan(halfFov) * visibleHeight) / viewport.height);
  const halfVisibleHorizontal = Math.atan((Math.tan(halfFov) * visibleWidth) / viewport.height);
  return (radius * overviewMargin) / Math.sin(Math.min(halfVisibleVertical, halfVisibleHorizontal));
}

function streetLook(shape: Shape, floorY: number) {
  const stand = Math.min(streetStandMeters, shape.halfSize * 0.9);
  return {
    position: [stand * 0.25, floorY + streetEyeMeters, stand] as Vector,
    target: [0, floorY + 12, 0] as Vector,
  };
}

function cameraFor(view: SceneView, shape: Shape, floorY: number, viewport: Viewport) {
  const { frame, thickness, halfSize } = shape;
  if (view === "street") {
    return streetLook(shape, floorY);
  }
  if (view === "cutaway") {
    return {
      position: [frame * 0.45, frame * 0.15, frame * 2.2],
      target: [0, -thickness * 0.4, 0],
    };
  }
  const center: Vector = [0, -thickness / 2, 0];
  const radius = Math.hypot(halfSize, halfSize, thickness / 2);
  const distance = fitDistance(radius, viewport);
  return {
    position: [
      center[0] + overviewDirection.x * distance,
      center[1] + overviewDirection.y * distance,
      center[2] + overviewDirection.z * distance,
    ],
    target: center,
  };
}

function partAnchor(part: ScenePart, shape: Shape, floorY: number): Vector {
  const { radiusM, halfSize, thickness, share } = shape;
  if (part === "edge") {
    return [radiusM, floorY * share(radiusM, 0), 0];
  }
  if (part === "house") {
    return [0, floorY + 14, 0];
  }
  if (part === "clay") {
    const x = -radiusM * 0.6;
    return [x, layerMiddleY(layerIndexOf("softClay"), shape, floorY * share(x, 0)), faceOffset];
  }
  if (part === "well") {
    const { bottom } = wellSpan(shape, floorY);
    return [shape.wellX, bottom, faceOffset];
  }
  if (part === "sea") {
    return [0, shape.seaY, faceOffset];
  }
  if (part === "block") {
    return [halfSize, -thickness / 2, 0];
  }
  return [0, floorY, 0];
}

function cameraForPart(part: ScenePart, shape: Shape, floorY: number) {
  const { radiusM, halfSize, frame, thickness } = shape;
  const target = partAnchor(part, shape, floorY);
  if (part === "edge") {
    return { position: [radiusM * 2.2, halfSize * 0.35, radiusM * 1.1], target };
  }
  if (part === "house") {
    return streetLook(shape, floorY);
  }
  if (part === "clay") {
    return { position: [-radiusM * 0.2, -thickness * 0.2, frame * 1.4], target };
  }
  if (part === "well") {
    return { position: [shape.wellX + radiusM * 0.6, -thickness * 0.45, frame * 1.3], target };
  }
  if (part === "sea") {
    return { position: [halfSize * 0.3, shape.seaY + thickness * 0.12, frame * 1.6], target };
  }
  if (part === "block") {
    return { position: [halfSize * 2.6, halfSize * 0.2, halfSize * 0.9], target };
  }
  return { position: [radiusM * 1.2, halfSize * 0.6, radiusM * 1.6], target };
}

function partAtPoint(point: THREE.Vector3, radiusM: number): ScenePart {
  const distance = Math.hypot(point.x, point.z);
  if (distance < radiusM * 0.6) {
    return "center";
  }
  if (distance < radiusM * 1.8) {
    return "edge";
  }
  return "block";
}

function partOfLayer(id: SoilLayerId): ScenePart {
  return clayLayerIds.includes(id) ? "clay" : "block";
}

function isClick(event: ThreeEvent<MouseEvent>) {
  return event.delta <= clickMoveLimitPx;
}

function layerColor(id: SoilLayerId, colors: SceneColors, part: ScenePart) {
  const color = colors.layers[id];
  if (part === "clay" && clayLayerIds.includes(id)) {
    return color.clone().lerp(colors.brand, pickedClayTint);
  }
  return color;
}

function contourPositions(depthMeters: number, exaggeration: number, radiusM: number) {
  const points: number[] = [];
  for (const ring of contourRings(depthMeters, radiusM)) {
    const { radius } = ring;
    const y = -ring.depth * exaggeration + 0.4;
    for (let segment = 0; segment < ringSegments; segment += 1) {
      const from = (segment / ringSegments) * Math.PI * 2;
      const to = ((segment + 1) / ringSegments) * Math.PI * 2;
      points.push(Math.cos(from) * radius, y, Math.sin(from) * radius);
      points.push(Math.cos(to) * radius, y, Math.sin(to) * radius);
    }
  }
  return new Float32Array(points);
}

function cutFaceLayers(shape: Shape, floorY: number, cutZ: number) {
  const { halfSize, thickness, share } = shape;
  const xs = Array.from(
    { length: surfaceSegments + 1 },
    (_, step) => -halfSize + (step / surfaceSegments) * halfSize * 2,
  );
  return soilLayers.map((layer, index) => {
    const outline = new THREE.Shape();
    xs.forEach((x, step) => {
      const y = layerTopY(index, thickness, floorY * share(x, cutZ));
      if (step === 0) {
        outline.moveTo(x, y);
      } else {
        outline.lineTo(x, y);
      }
    });
    for (const x of xs.toReversed()) {
      const bottom =
        index + 1 < soilLayers.length
          ? layerTopY(index + 1, thickness, floorY * share(x, cutZ))
          : -thickness;
      outline.lineTo(x, bottom);
    }
    outline.closePath();
    return { id: layer.id, geometry: new THREE.ShapeGeometry(outline) };
  });
}

function waterFace(shape: Shape, floorY: number, cutZ: number) {
  const { halfSize, share, seaY } = shape;
  const xs = Array.from(
    { length: surfaceSegments + 1 },
    (_, step) => -halfSize + (step / surfaceSegments) * halfSize * 2,
  );
  const wet = xs.filter((x) => floorY * share(x, cutZ) < seaY);
  if (wet.length < 2) {
    return null;
  }
  const outline = new THREE.Shape();
  outline.moveTo(wet[0], seaY);
  for (const x of wet) {
    outline.lineTo(x, floorY * share(x, cutZ));
  }
  outline.lineTo(wet[wet.length - 1], seaY);
  outline.closePath();
  return new THREE.ShapeGeometry(outline);
}

function gapFace(shape: Shape, floorY: number, ghostFloorY: number, cutZ: number) {
  const { halfSize, share } = shape;
  const xs = Array.from(
    { length: surfaceSegments + 1 },
    (_, step) => -halfSize + (step / surfaceSegments) * halfSize * 2,
  );
  const outline = new THREE.Shape();
  xs.forEach((x, step) => {
    const y = floorY * share(x, cutZ);
    if (step === 0) {
      outline.moveTo(x, y);
    } else {
      outline.lineTo(x, y);
    }
  });
  for (const x of xs.toReversed()) {
    outline.lineTo(x, ghostFloorY * share(x, cutZ));
  }
  outline.closePath();
  return new THREE.ShapeGeometry(outline);
}

function easeInOutCubic(progress: number) {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

function RadarSweep({
  shape,
  isRadarYear,
  part,
  color,
  clipPlanes,
}: {
  shape: Shape;
  isRadarYear: boolean;
  part: ScenePart;
  color: THREE.Color;
  clipPlanes: THREE.Plane[];
}) {
  const invalidate = useThree((state) => state.invalidate);
  const meshRef = useRef<THREE.Mesh>(null);
  const startRef = useRef<number | null>(null);
  const previousRef = useRef({ isRadarYear, isRadarPart: part === "radar" });
  const { halfSize, thickness } = shape;
  const curtainTop = halfSize * 0.12;

  useEffect(() => {
    const previous = previousRef.current;
    const isRadarPart = part === "radar";
    previousRef.current = { isRadarYear, isRadarPart };
    const isStarting =
      (isRadarYear && !previous.isRadarYear) || (isRadarPart && !previous.isRadarPart);
    if (isStarting && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      startRef.current = performance.now();
      invalidate();
    }
  }, [isRadarYear, part, invalidate]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) {
      return;
    }
    const start = startRef.current;
    const progress = start === null ? 1 : (performance.now() - start) / sweepMilliseconds;
    if (progress >= 1) {
      startRef.current = null;
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.x = -halfSize + easeInOutCubic(progress) * halfSize * 2;
    (mesh.material as THREE.MeshBasicMaterial).opacity =
      sweepOpacity * Math.sin(Math.PI * progress);
    invalidate();
  });

  return (
    <mesh
      ref={meshRef}
      visible={false}
      position={[0, (curtainTop - thickness) / 2, 0]}
      rotation={[0, Math.PI / 2, 0]}
    >
      <planeGeometry args={[halfSize * 2, thickness + curtainTop]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
        clippingPlanes={clipPlanes}
      />
    </mesh>
  );
}

function pressurePoints(shape: Shape, cutZ: number): Vector[] {
  const { halfSize, thickness, radiusM, wellX } = shape;
  const aquiferIndex = layerIndexOf("aquifer");
  const top = layerTopY(aquiferIndex, thickness, 0);
  const drawdown = (top + thickness) * 0.55;
  const spread = radiusM * 1.2;
  return Array.from({ length: 81 }, (_, step) => {
    const x = -halfSize + (step / 80) * halfSize * 2;
    const offset = (x - wellX) / spread;
    return [x, top - drawdown * Math.exp(-(offset * offset)), cutZ + faceOffset * 2];
  });
}

function PartMarker({
  position,
  size,
  color,
}: {
  position: Vector;
  size: number;
  color: THREE.Color;
}) {
  return (
    <group position={position}>
      <mesh position={[0, size * 6, 0]}>
        <sphereGeometry args={[size, 24, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, size * 3, 0]}>
        <cylinderGeometry args={[size * 0.15, size * 0.15, size * 6, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

type SceneLabelItem = { key: string; text: string; position: Vector };

// Plain DOM labels over the canvas. drei's Html mounts a second React root and warns on unmount.
function SceneLabels({ items, insets }: { items: SceneLabelItem[]; insets: SceneInsets }) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const itemsRef = useRef(items);
  const elementsRef = useRef<HTMLSpanElement[]>([]);
  const widthsRef = useRef<number[]>([]);
  const point = useMemo(() => new THREE.Vector3(), []);
  const signature = items.map((item) => `${item.key}:${item.text}`).join("|");

  useLayoutEffect(() => {
    itemsRef.current = items;
  });

  useEffect(() => {
    const host = gl.domElement.closest<HTMLElement>("[role='img']");
    if (!host) {
      return;
    }
    const elements = itemsRef.current.map((item) => {
      const element = document.createElement("span");
      element.textContent = item.text;
      element.className =
        "pointer-events-none absolute top-0 left-0 text-xs whitespace-nowrap text-foreground/80 opacity-0 transition-opacity duration-200 ease-out motion-reduce:transition-none";
      host.appendChild(element);
      return element;
    });
    widthsRef.current = elements.map((element) => element.offsetWidth);
    elementsRef.current = elements;
    invalidate();
    return () => {
      for (const element of elements) {
        element.remove();
      }
      elementsRef.current = [];
    };
  }, [gl, signature, invalidate]);

  useFrame(() => {
    // The renderer refreshes this matrix after useFrame, so without this the labels trail the canvas by a frame.
    camera.updateMatrixWorld();
    itemsRef.current.forEach((item, index) => {
      const element = elementsRef.current[index];
      if (!element) {
        return;
      }
      point.set(...item.position).project(camera);
      const minX = insets.left + labelEdgeMargin;
      const maxX = size.width - insets.right - widthsRef.current[index] - labelEdgeMargin;
      const x = Math.min(Math.max((point.x * 0.5 + 0.5) * size.width, minX), maxX);
      const y = (-point.y * 0.5 + 0.5) * size.height;
      element.style.transform = `translate(${x}px, ${y}px) translateY(-50%)`;
      element.style.visibility = point.z > 1 ? "hidden" : "visible";
      element.style.opacity = "1";
    });
  });

  return null;
}

function GroundBlock({
  bowl,
  shape,
  depthMeters,
  exaggeration,
  isCut,
  layers,
  part,
  onPick,
  colors,
  labels,
  ghostDepthMeters,
  isRadarYear,
  insets,
}: {
  insets: SceneInsets;
  bowl: SceneBowl;
  shape: Shape;
  depthMeters: number;
  exaggeration: number;
  isCut: boolean;
  layers: SceneLayers;
  part: ScenePart;
  onPick: (part: ScenePart) => void;
  colors: SceneColors;
  labels: SceneLabels;
  ghostDepthMeters: number | null;
  isRadarYear: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const { halfSize, thickness, share } = shape;
  const floorY = -depthMeters * exaggeration;
  const cutRef = useRef(isCut ? 0 : halfSize);
  const [cutZ, setCutZ] = useState(cutRef.current);
  const isFullyCut = isCut && cutZ === 0;
  const clipPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 0, -1), isCut ? 0 : halfSize),
    [halfSize],
  );
  const clipPlanes = useMemo(() => [clipPlane], [clipPlane]);

  function pickSurface(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (isClick(event)) {
      onPick(partAtPoint(event.point, bowl.radiusM));
    }
  }

  function pickPart(event: ThreeEvent<MouseEvent>, picked: ScenePart) {
    event.stopPropagation();
    if (isClick(event)) {
      onPick(picked);
    }
  }

  const surface = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(
      halfSize * 2,
      halfSize * 2,
      surfaceSegments,
      surfaceSegments,
    );
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [halfSize]);

  useLayoutEffect(() => {
    const positions = surface.attributes.position;
    const vertexColors = new Float32Array(positions.count * 3);
    const color = new THREE.Color();
    for (let index = 0; index < positions.count; index += 1) {
      const rateShare = layers.rate ? share(positions.getX(index), positions.getZ(index)) : 0;
      color.copy(colors.ground).lerp(colors.rate, rateShare);
      color.toArray(vertexColors, index * 3);
    }
    surface.setAttribute("color", new THREE.BufferAttribute(vertexColors, 3));
    invalidate();
  }, [surface, colors, share, layers.rate, invalidate]);

  useLayoutEffect(() => {
    const positions = surface.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      positions.setY(index, floorY * share(positions.getX(index), positions.getZ(index)));
    }
    positions.needsUpdate = true;
    surface.computeVertexNormals();
    invalidate();
  }, [surface, floorY, share, invalidate]);

  const contours = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(contourPositions(depthMeters, exaggeration, bowl.radiusM), 3),
    );
    return geometry;
  }, [depthMeters, exaggeration, bowl.radiusM]);

  const faceLayers = useMemo(() => cutFaceLayers(shape, floorY, cutZ), [shape, floorY, cutZ]);
  const well = wellSpan(shape, floorY);
  const water = useMemo(() => waterFace(shape, floorY, cutZ), [shape, floorY, cutZ]);
  const ghostFloorY = ghostDepthMeters === null ? null : -ghostDepthMeters * exaggeration;
  const gap = useMemo(
    () => (ghostFloorY === null ? null : gapFace(shape, floorY, ghostFloorY, cutZ)),
    [shape, floorY, ghostFloorY, cutZ],
  );
  const ghostSurface = useMemo(() => {
    const reach = Math.min(halfSize, shape.radiusM * ghostReach);
    const geometry = new THREE.PlaneGeometry(reach * 2, reach * 2, ghostSegments, ghostSegments);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, [halfSize, shape.radiusM]);

  useLayoutEffect(() => {
    const positions = ghostSurface.attributes.position;
    const vertexColors = new Float32Array(positions.count * 4);
    for (let index = 0; index < positions.count; index += 1) {
      const bowlShare = share(positions.getX(index), positions.getZ(index));
      positions.setY(index, (ghostFloorY ?? 0) * bowlShare);
      vertexColors.set(
        [colors.brand.r, colors.brand.g, colors.brand.b, Math.min(1, bowlShare * ghostFadeRate)],
        index * 4,
      );
    }
    positions.needsUpdate = true;
    ghostSurface.setAttribute("color", new THREE.BufferAttribute(vertexColors, 4));
    invalidate();
  }, [ghostSurface, ghostFloorY, share, colors.brand, invalidate]);

  useEffect(() => {
    return () => {
      gap?.dispose();
    };
  }, [gap]);

  useEffect(() => {
    return () => {
      ghostSurface.dispose();
    };
  }, [ghostSurface]);

  const wellTop = well.top;
  const labelItems = useMemo(() => {
    const labelZ = faceOffset * 3;
    const aquiferTop = layerTopY(layerIndexOf("aquifer"), thickness, 0);
    return [
      ...soilLayers.map((layer, index) => ({
        key: layer.id,
        text: labels.layers[layer.id],
        position: [-halfSize * 0.6, layerMiddleY(index, shape, 0), labelZ] as Vector,
      })),
      {
        key: "well",
        text: labels.well,
        position: [shape.wellX + halfSize * 0.02, wellTop - thickness * 0.04, labelZ] as Vector,
      },
      {
        key: "pressure",
        text: labels.pressure,
        position: [halfSize * 0.2, aquiferTop - thickness * 0.03, labelZ] as Vector,
      },
      {
        key: "highTide",
        text: labels.highTide,
        position: [halfSize * 0.35, shape.seaY + thickness * 0.025, labelZ] as Vector,
      },
    ];
  }, [shape, halfSize, thickness, wellTop, labels]);

  useEffect(() => {
    return () => {
      water?.dispose();
    };
  }, [water]);

  useEffect(() => {
    return () => {
      surface.dispose();
    };
  }, [surface]);

  useEffect(() => {
    return () => {
      contours.dispose();
    };
  }, [contours]);

  useEffect(() => {
    return () => {
      for (const layer of faceLayers) {
        layer.geometry.dispose();
      }
    };
  }, [faceLayers]);

  useEffect(() => {
    invalidate();
  }, [isCut, part, invalidate]);

  useFrame((_, deltaSeconds) => {
    const target = isCut ? 0 : halfSize;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gap = target - cutRef.current;
    if (Math.abs(gap) < 0.5) {
      if (cutRef.current !== target) {
        cutRef.current = target;
        clipPlane.constant = target;
        setCutZ(target);
      }
      return;
    }
    const pull = isReduced ? 1 : 1 - Math.exp(-deltaSeconds / cutSettleSeconds);
    cutRef.current += gap * pull;
    clipPlane.constant = cutRef.current;
    setCutZ(cutRef.current);
    invalidate();
  });

  return (
    <group>
      <mesh geometry={surface} onClick={pickSurface}>
        <meshStandardMaterial
          vertexColors
          roughness={0.95}
          side={THREE.DoubleSide}
          clippingPlanes={clipPlanes}
        />
      </mesh>
      {layers.buildings || layers.scenery ? (
        <BowlBuildings
          center={bowl.center}
          radiusM={bowl.radiusM}
          halfSize={halfSize}
          floorY={floorY}
          showBuildings={layers.buildings}
          showScenery={layers.scenery}
          isDark={colors.isDark}
          brand={colors.brand}
          selected={part === "house"}
          clipPlanes={clipPlanes}
          onSelect={(event) => pickPart(event, "house")}
        />
      ) : null}
      {layers.contours ? (
        <lineSegments geometry={contours}>
          <lineBasicMaterial
            color={colors.line}
            transparent
            opacity={0.3}
            clippingPlanes={clipPlanes}
          />
        </lineSegments>
      ) : null}
      {faceLayers.map((layer) => (
        <mesh
          key={layer.id}
          geometry={layer.geometry}
          position={[0, 0, cutZ]}
          onClick={(event) => pickPart(event, partOfLayer(layer.id))}
        >
          <meshStandardMaterial
            color={layerColor(layer.id, colors, part)}
            roughness={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
      {soilLayers.map((layer, index) => {
        const height = layer.share * thickness;
        const centerY = layerTopY(index, thickness, 0) - height / 2;
        const color = layerColor(layer.id, colors, part);
        return (
          <group key={layer.id}>
            {[-halfSize, halfSize].map((x) => (
              <mesh
                key={x}
                position={[x, centerY, 0]}
                rotation={[0, Math.PI / 2, 0]}
                onClick={(event) => pickPart(event, partOfLayer(layer.id))}
              >
                <planeGeometry args={[halfSize * 2, height]} />
                <meshStandardMaterial
                  color={color}
                  roughness={1}
                  side={THREE.DoubleSide}
                  clippingPlanes={clipPlanes}
                />
              </mesh>
            ))}
            <mesh position={[0, centerY, -halfSize]}>
              <planeGeometry args={[halfSize * 2, height]} />
              <meshStandardMaterial color={color} roughness={1} side={THREE.DoubleSide} />
            </mesh>
          </group>
        );
      })}
      <mesh position={[0, -thickness, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[halfSize * 2, halfSize * 2]} />
        <meshStandardMaterial
          color={colors.layers.aquifer}
          roughness={1}
          side={THREE.DoubleSide}
          clippingPlanes={clipPlanes}
        />
      </mesh>
      <mesh
        position={[shape.wellX, (well.top + well.bottom) / 2, faceOffset]}
        onClick={(event) => pickPart(event, "well")}
      >
        <cylinderGeometry args={[halfSize * 0.006, halfSize * 0.006, well.top - well.bottom, 16]} />
        <meshStandardMaterial
          color={part === "well" ? colors.brand : colors.house}
          roughness={0.6}
        />
      </mesh>
      {layers.sea ? (
        <mesh
          position={[0, shape.seaY, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(event) => pickPart(event, "sea")}
        >
          <planeGeometry args={[halfSize * 2, halfSize * 2]} />
          <meshStandardMaterial
            color={colors.water}
            roughness={0.3}
            transparent
            opacity={0.6}
            depthWrite={false}
            side={THREE.DoubleSide}
            clippingPlanes={clipPlanes}
          />
        </mesh>
      ) : null}
      {ghostFloorY !== null && layers.banGrid ? (
        <mesh geometry={ghostSurface} renderOrder={2}>
          <meshBasicMaterial
            vertexColors
            wireframe
            transparent
            opacity={0.5}
            depthTest={false}
            clippingPlanes={clipPlanes}
          />
        </mesh>
      ) : null}
      {gap ? (
        <mesh geometry={gap} position={[0, 0, cutZ + faceOffset * 1.5]}>
          <meshBasicMaterial
            color={colors.brand}
            transparent
            opacity={0.45}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      <RadarSweep
        shape={shape}
        isRadarYear={isRadarYear}
        part={part}
        color={colors.brand}
        clipPlanes={clipPlanes}
      />
      {water && layers.sea ? (
        <mesh geometry={water} position={[0, 0, cutZ]} onClick={(event) => pickPart(event, "sea")}>
          <meshStandardMaterial
            color={colors.water}
            roughness={0.3}
            transparent
            opacity={0.6}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {isFullyCut ? (
        <>
          {layers.sea ? (
            <Line
              points={[
                [-halfSize, shape.seaY, cutZ + faceOffset * 2],
                [halfSize, shape.seaY, cutZ + faceOffset * 2],
              ]}
              color={part === "sea" ? colors.brand : colors.water}
              lineWidth={part === "sea" ? 3 : 1.5}
            />
          ) : null}
          {layers.labels ? <SceneLabels items={labelItems} insets={insets} /> : null}
          <Line
            points={pressurePoints(shape, cutZ)}
            color={colors.line}
            lineWidth={1.5}
            dashed
            dashSize={halfSize * 0.02}
            gapSize={halfSize * 0.015}
            transparent
            opacity={0.6}
          />
        </>
      ) : null}
      {(part !== "house" || !layers.buildings) &&
      part !== "well" &&
      part !== "sea" &&
      part !== "radar" ? (
        <PartMarker
          position={partAnchor(part, shape, floorY)}
          size={halfSize * 0.012}
          color={colors.brand}
        />
      ) : null}
    </group>
  );
}

function SceneCamera({
  view,
  part,
  shape,
  floorY,
  insets,
}: {
  view: SceneView;
  part: ScenePart;
  shape: Shape;
  floorY: number;
  insets: SceneInsets;
}) {
  const controlsRef = useRef<CameraControls>(null);
  const hasAimedAtPartRef = useRef(false);

  function lookAt({ position, target }: { position: number[]; target: number[] }) {
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controlsRef.current?.setLookAt(
      position[0],
      position[1],
      position[2],
      target[0],
      target[1],
      target[2],
      !isReduced,
    );
  }

  const size = useThree((state) => state.size);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const viewportKey = `${Math.round(size.width / 20)}x${Math.round(size.height / 20)}:${insets.top}:${insets.bottom}:${insets.left}:${insets.right}`;

  // Shift the frame so the object centers in the part of the scene the tiles leave free.
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) {
      return;
    }
    const shiftX = (insets.left - insets.right) / 2;
    const shiftY = (insets.top - insets.bottom) / 2;
    camera.setViewOffset(size.width, size.height, -shiftX, -shiftY, size.width, size.height);
    invalidate();
    return () => {
      camera.clearViewOffset();
    };
  }, [
    camera,
    invalidate,
    size.width,
    size.height,
    insets.top,
    insets.bottom,
    insets.left,
    insets.right,
  ]);

  const aimAtView = useEffectEvent(() => {
    lookAt(cameraFor(view, shape, floorY, { width: size.width, height: size.height, ...insets }));
  });

  const aimAtPart = useEffectEvent(() => {
    if (!hasAimedAtPartRef.current) {
      hasAimedAtPartRef.current = true;
      return;
    }
    lookAt(cameraForPart(part, shape, floorY));
  });

  useEffect(() => {
    aimAtView();
  }, [view, shape.frame, viewportKey]);

  useEffect(() => {
    aimAtPart();
  }, [part]);

  const limits = {
    minDistance: 6,
    maxDistance: shape.frame * 14,
    minPolarAngle: 0.05,
    maxPolarAngle: Math.PI / 2 - 0.02,
  };
  useRubberBand(controlsRef, limits);
  useOrbitGestures(controlsRef, shape.frame);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      smoothTime={cameraSmoothSeconds}
      draggingSmoothTime={cameraDragSmoothSeconds}
      {...limits}
    />
  );
}

export function BowlScene({
  bowl,
  depthMeters,
  deepestDepthMeters,
  seaDepthMeters,
  ghostDepthMeters,
  isRadarYear,
  exaggeration,
  view,
  part,
  onPick,
  label,
  labels,
  insets,
  layers,
}: {
  insets: SceneInsets;
  layers: SceneLayers;
  bowl: SceneBowl;
  depthMeters: number;
  deepestDepthMeters: number;
  seaDepthMeters: number;
  ghostDepthMeters: number | null;
  isRadarYear: boolean;
  exaggeration: number;
  view: SceneView;
  part: ScenePart;
  onPick: (part: ScenePart) => void;
  label: string;
  labels: SceneLabels;
}) {
  const colors = useSceneColors(bowl.rateMmYr);
  const shape = useMemo(
    () => bowlShape(bowl.radiusM, deepestDepthMeters * exaggeration, seaDepthMeters * exaggeration),
    [bowl.radiusM, deepestDepthMeters, seaDepthMeters, exaggeration],
  );
  const floorY = -depthMeters * exaggeration;
  const start = cameraFor(view, shape, floorY, { ...startViewport, ...insets });

  return (
    <div role="img" aria-label={label} className="relative size-full overflow-hidden">
      {colors ? (
        <Canvas
          frameloop="demand"
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          camera={{
            fov: sceneFov,
            near: 1,
            far: shape.frame * 30,
            position: start.position as Vector,
          }}
          onCreated={({ gl }) => {
            gl.localClippingEnabled = true;
          }}
        >
          <hemisphereLight args={[0xffffff, 0x888888, 1.6]} />
          <directionalLight
            position={[shape.halfSize, shape.frame * 2, shape.halfSize * 1.5]}
            intensity={1.4}
          />
          <GroundBlock
            bowl={bowl}
            shape={shape}
            depthMeters={depthMeters}
            exaggeration={exaggeration}
            isCut={view === "cutaway"}
            layers={layers}
            part={part}
            onPick={onPick}
            colors={colors}
            labels={labels}
            ghostDepthMeters={ghostDepthMeters}
            isRadarYear={isRadarYear}
            insets={insets}
          />
          <SceneCamera view={view} part={part} shape={shape} floorY={floorY} insets={insets} />
        </Canvas>
      ) : null}
    </div>
  );
}
