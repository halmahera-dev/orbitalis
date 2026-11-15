export const slowRateMmYr = 20;
export const middleRateMmYr = 55;
export const fastRateMmYr = 100;

export type RateClass = "slow" | "middle" | "fast";

export function rateClass(rateMmYr: number): RateClass {
  if (rateMmYr >= middleRateMmYr) {
    return "fast";
  }
  return rateMmYr >= slowRateMmYr ? "middle" : "slow";
}
