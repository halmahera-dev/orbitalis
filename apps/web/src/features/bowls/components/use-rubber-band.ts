import type { CameraControls } from "@react-three/drei";
import { useEffect, type RefObject } from "react";
import * as THREE from "three";

const resistance = 0.55;
const settleDelayMs = 150;
const polarStretchRange = 0.5;
const nearStretchShare = 0.5;
const farStretchShare = 0.25;
const looseMinDistance = 0.1;
const looseMaxDistanceFactor = 10;

type CameraLimits = {
  minDistance: number;
  maxDistance: number;
  minPolarAngle: number;
  maxPolarAngle: number;
};

function rubberBand(overshoot: number, range: number) {
  return (1 - 1 / ((resistance * overshoot) / range + 1)) * range;
}

function stretch(raw: number, min: number, max: number, range: number) {
  if (raw > max) {
    return max + rubberBand(raw - max, range);
  }
  if (raw < min) {
    return min - rubberBand(min - raw, range);
  }
  return raw;
}

export function useRubberBand(
  controlsRef: RefObject<CameraControls | null>,
  { minDistance, maxDistance, minPolarAngle, maxPolarAngle }: CameraLimits,
) {
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const nearRange = minDistance * nearStretchShare;
    const farRange = maxDistance * farStretchShare;
    const target = new THREE.Spherical();
    let rawPolar = 0;
    let rawDistance = 0;
    let appliedPolar = 0;
    let appliedDistance = 0;
    const restSmoothTime = controls.smoothTime;
    let isDragging = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.minDistance = looseMinDistance;
    controls.maxDistance = maxDistance * looseMaxDistanceFactor;

    function syncToTarget() {
      controls?.getSpherical(target, true);
      rawPolar = target.phi;
      appliedPolar = target.phi;
      rawDistance = target.radius;
      appliedDistance = target.radius;
    }

    function settle() {
      settleTimer = undefined;
      if (controls) {
        controls.smoothTime = restSmoothTime;
      }
      const isOutside =
        rawPolar < minPolarAngle ||
        rawPolar > maxPolarAngle ||
        rawDistance < minDistance ||
        rawDistance > maxDistance;
      if (isDragging || !isOutside) {
        return;
      }
      controls?.rotatePolarTo(THREE.MathUtils.clamp(rawPolar, minPolarAngle, maxPolarAngle), true);
      controls?.dollyTo(THREE.MathUtils.clamp(rawDistance, minDistance, maxDistance), true);
      rawPolar = THREE.MathUtils.clamp(rawPolar, minPolarAngle, maxPolarAngle);
      appliedPolar = rawPolar;
      rawDistance = THREE.MathUtils.clamp(rawDistance, minDistance, maxDistance);
      appliedDistance = rawDistance;
    }

    function handleControlStart() {
      isDragging = true;
      syncToTarget();
    }

    function handleControl() {
      if (controls) {
        controls.smoothTime = controls.draggingSmoothTime;
      }
      controls?.getSpherical(target, true);
      rawPolar += target.phi - appliedPolar;
      rawDistance += target.radius - appliedDistance;
      appliedPolar = stretch(rawPolar, minPolarAngle, maxPolarAngle, polarStretchRange);
      appliedDistance = stretch(rawDistance, minDistance, maxDistance, rawDistance > maxDistance ? farRange : nearRange);
      if (appliedPolar !== rawPolar) {
        controls?.rotatePolarTo(appliedPolar, true);
      }
      if (appliedDistance !== rawDistance) {
        controls?.dollyTo(appliedDistance, true);
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, settleDelayMs);
    }

    function handleControlEnd() {
      isDragging = false;
      clearTimeout(settleTimer);
      settle();
    }

    function handleRest() {
      if (!isDragging && settleTimer === undefined) {
        syncToTarget();
      }
    }

    syncToTarget();
    controls.addEventListener("controlstart", handleControlStart);
    controls.addEventListener("control", handleControl);
    controls.addEventListener("controlend", handleControlEnd);
    controls.addEventListener("rest", handleRest);

    return () => {
      clearTimeout(settleTimer);
      controls.smoothTime = restSmoothTime;
      controls.removeEventListener("controlstart", handleControlStart);
      controls.removeEventListener("control", handleControl);
      controls.removeEventListener("controlend", handleControlEnd);
      controls.removeEventListener("rest", handleRest);
      controls.minPolarAngle = minPolarAngle;
      controls.maxPolarAngle = maxPolarAngle;
      controls.minDistance = minDistance;
      controls.maxDistance = maxDistance;
    };
  }, [controlsRef, minDistance, maxDistance, minPolarAngle, maxPolarAngle]);
}
