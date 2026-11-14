import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

import type { Footprint } from "@/features/bowls/building-footprints";
import type { PartContext } from "@/features/buildings/building-shapes";

import {
  genericParts,
  hospitalParts,
  houseParts,
  industrialParts,
  mosqueParts,
  schoolParts,
} from "@/features/buildings/building-type-parts";

function buildingParts(context: PartContext) {
  switch (context.footprint.type) {
    case "house":
      return houseParts(context);
    case "worship":
      return mosqueParts(context);
    case "school":
      return schoolParts(context);
    case "hospital":
      return hospitalParts(context);
    case "industrial":
      return industrialParts(context);
    default:
      return genericParts(context);
  }
}

// Local meters: x is east, y is up, z is south. `shareFor` adds a per-building "share" attribute.
export function buildBuildingGeometry(
  footprints: Footprint[],
  shareFor?: (footprint: Footprint) => number,
) {
  const parts = footprints.flatMap((footprint) =>
    buildingParts({ footprint, share: shareFor?.(footprint) }),
  );
  const geometry = mergeGeometries(parts);
  for (const part of parts) {
    part.dispose();
  }
  return geometry;
}
