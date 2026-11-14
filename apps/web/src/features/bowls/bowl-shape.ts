const contourStepMeters = 0.1;
const maxContours = 40;
const blockDepthPerDrop = 2.2;
const seaDepthMargin = 1.15;

// An illustration, not a measured profile. `squeeze` is each layer's share of the sinking.
export const soilLayers = [
  { id: "fill", share: 0.06, squeeze: 0 },
  { id: "softClay", share: 0.4, squeeze: 0.7 },
  { id: "sand", share: 0.14, squeeze: 0 },
  { id: "stiffClay", share: 0.18, squeeze: 0.3 },
  { id: "aquifer", share: 0.22, squeeze: 0 },
] as const;

export type SoilLayerId = (typeof soilLayers)[number]["id"];

export function blockThickness(radiusM: number, deepestDropMeters: number, seaDepthMeters = 0) {
  return Math.max(
    blockHalfSize(radiusM) * 0.35,
    deepestDropMeters * blockDepthPerDrop,
    seaDepthMeters * seaDepthMargin,
  );
}

export function banYearOf(banDate: string) {
  const date = new Date(banDate);
  return date.getUTCFullYear() + date.getUTCMonth() / 12;
}

export function sinkingBetweenMeters(
  rates: { beforeBanMmYr: number; afterBanMmYr: number },
  banYear: number,
  fromYear: number,
  toYear: number,
) {
  const yearsBeforeBan = Math.max(0, Math.min(banYear, toYear) - fromYear);
  const yearsAfterBan = Math.max(0, toYear - Math.max(banYear, fromYear));
  return (rates.beforeBanMmYr * yearsBeforeBan + rates.afterBanMmYr * yearsAfterBan) / 1000;
}

export function firstYearBelow(
  levelM: number,
  floorAt: (year: number) => number,
  fromYear: number,
  toYear: number,
) {
  for (let year = fromYear; year <= toYear; year += 1) {
    if (floorAt(year) <= levelM) {
      return year;
    }
  }
  return null;
}

export function layerTopY(layerIndex: number, thickness: number, surfaceDropY: number) {
  const layersAbove = soilLayers.slice(0, layerIndex);
  const layersBelow = soilLayers.slice(layerIndex);
  const restingY = -thickness * layersAbove.reduce((sum, layer) => sum + layer.share, 0);
  const squeezeBelow = layersBelow.reduce((sum, layer) => sum + layer.squeeze, 0);
  return restingY + surfaceDropY * squeezeBelow;
}

export function bowlSpread(radiusM: number) {
  return radiusM / 1.5;
}

export function depthShareAt(distanceM: number, radiusM: number) {
  const spread = bowlSpread(radiusM);
  return Math.exp(-(distanceM * distanceM) / (spread * spread));
}

export function wellOffsetM(radiusM: number) {
  return radiusM * 0.25;
}

export function blockHalfSize(radiusM: number) {
  return radiusM * 2;
}

export function contourRings(depthMeters: number, radiusM: number) {
  const ringCount = Math.min(Math.floor(depthMeters / contourStepMeters), maxContours);
  const spread = bowlSpread(radiusM);
  return Array.from({ length: ringCount }, (_, index) => {
    const depth = (index + 1) * contourStepMeters;
    return { depth, radius: spread * Math.sqrt(Math.log(depthMeters / depth)) };
  });
}
