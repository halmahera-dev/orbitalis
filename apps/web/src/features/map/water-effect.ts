const metersPerDegree = 111_320;
export const nearWaterMarginM = 500;

type Point = [number, number];
type RatedCell = { center: Point; sinkingMmYr: number | null };
type WaterBody = { center: Point; radiusM: number };

export type GroupStats = { count: number; meanMmYr: number; errorMmYr: number };
export type WaterEffect = { near: GroupStats; far: GroupStats; isClear: boolean };

function distanceM([lon1, lat1]: Point, [lon2, lat2]: Point) {
  const east = (lon2 - lon1) * metersPerDegree * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot(east, (lat2 - lat1) * metersPerDegree);
}

function stats(rates: number[]): GroupStats {
  const count = rates.length;
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / count;
  const variance =
    rates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / Math.max(count - 1, 1);
  return { count, meanMmYr: mean, errorMmYr: Math.sqrt(variance / count) };
}

// ponytail: standard error treats cells as independent; neighbors are correlated, so the real
// error is larger. Use a block bootstrap if this result drives a decision.
export function waterEffect(cells: RatedCell[], bodies: WaterBody[]): WaterEffect | null {
  const near: number[] = [];
  const far: number[] = [];
  for (const cell of cells) {
    if (cell.sinkingMmYr === null) {
      continue;
    }
    const isNear = bodies.some(
      (body) => distanceM(cell.center, body.center) <= body.radiusM + nearWaterMarginM,
    );
    (isNear ? near : far).push(cell.sinkingMmYr);
  }
  if (near.length < 2 || far.length < 2) {
    return null;
  }
  const nearStats = stats(near);
  const farStats = stats(far);
  const difference = Math.abs(nearStats.meanMmYr - farStats.meanMmYr);
  const combinedError = Math.hypot(nearStats.errorMmYr, farStats.errorMmYr);
  return { near: nearStats, far: farStats, isClear: difference > 2 * combinedError };
}
