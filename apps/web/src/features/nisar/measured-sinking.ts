export type MeasuredSinkingSite = {
  id: string;
  name: string;
  rateMmYr: number;
  kind: "bowl" | "candidate";
  seriesDownMm: number[];
};

export function fastestMeasuredSinking(
  sites: readonly MeasuredSinkingSite[],
): MeasuredSinkingSite | null {
  if (sites.length === 0) {
    return null;
  }
  return sites.reduce((best, site) => (site.rateMmYr > best.rateMmYr ? site : best));
}
