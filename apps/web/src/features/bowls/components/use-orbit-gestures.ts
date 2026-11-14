import type { CameraControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import CameraControlsImpl from "camera-controls";
import { useEffect, type RefObject } from "react";
import * as THREE from "three";

const { ACTION } = CameraControlsImpl;

const boundaryFrames = 2;
const wheelDollySpeed = 0.4;
const pinchZoomRate = 0.01;

type GestureEvent = Event & { scale: number };

export function useOrbitGestures(controlsRef: RefObject<CameraControls | null>, frame: number) {
  const domElement = useThree((state) => state.gl.domElement);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    const spherical = new THREE.Spherical();
    let gestureStartDistance = 0;

    controls.mouseButtons.left = ACTION.ROTATE;
    controls.mouseButtons.right = ACTION.TRUCK;
    controls.mouseButtons.wheel = ACTION.DOLLY;
    controls.touches.one = ACTION.TOUCH_ROTATE;
    controls.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
    controls.touches.three = ACTION.TOUCH_TRUCK;
    controls.dollySpeed = wheelDollySpeed;

    const boundary = frame * boundaryFrames;
    controls.setBoundary(
      new THREE.Box3(
        new THREE.Vector3(-boundary, -boundary, -boundary),
        new THREE.Vector3(boundary, boundary, boundary),
      ),
    );

    function dollyTo(distance: number) {
      controls?.dollyTo(distance, true);
      controls?.dispatchEvent({ type: "control" });
    }

    function currentDistance() {
      controls?.getSpherical(spherical, true);
      return spherical.radius;
    }

    function handlePointerDown(event: PointerEvent) {
      if (controls && event.pointerType === "mouse" && event.button === 0) {
        controls.mouseButtons.left = event.shiftKey ? ACTION.TRUCK : ACTION.ROTATE;
      }
    }

    // The library turns a trackpad pinch into camera zoom, which skips our distance limits.
    function handlePinchWheel(event: WheelEvent) {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      dollyTo(currentDistance() * Math.exp(event.deltaY * pinchZoomRate));
    }

    function handleGestureStart(event: Event) {
      event.preventDefault();
      gestureStartDistance = currentDistance();
    }

    // Safari reports a trackpad pinch as gesture events instead of a ctrl+wheel.
    function handleGestureChange(event: Event) {
      event.preventDefault();
      if (window.matchMedia("(pointer: fine)").matches) {
        dollyTo(gestureStartDistance / (event as GestureEvent).scale);
      }
    }

    domElement.addEventListener("pointerdown", handlePointerDown, { capture: true });
    domElement.addEventListener("wheel", handlePinchWheel, { capture: true, passive: false });
    domElement.addEventListener("gesturestart", handleGestureStart);
    domElement.addEventListener("gesturechange", handleGestureChange);

    return () => {
      controls.setBoundary();
      domElement.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      domElement.removeEventListener("wheel", handlePinchWheel, { capture: true });
      domElement.removeEventListener("gesturestart", handleGestureStart);
      domElement.removeEventListener("gesturechange", handleGestureChange);
    };
  }, [controlsRef, domElement, frame]);
}
