import type { PublicBowl } from "@/features/bowls/bowls-queries";

export const slowRateMmYr = 20;
export const middleRateMmYr = 55;
export const fastRateMmYr = 100;

export function dropMeters(bowl: PublicBowl, years: number, withBan: boolean) {
  const rateMmYr = withBan ? bowl.rateAfterBanMmYr : bowl.rateBeforeBanMmYr;
  return (rateMmYr * years) / 1000;
}
