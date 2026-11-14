export const buildingTypes = [
  "generic",
  "house",
  "worship",
  "school",
  "hospital",
  "industrial",
] as const;

export type BuildingType = (typeof buildingTypes)[number];

export const accentTypeCount = buildingTypes.length - 1;

export const paletteSize = 5;
