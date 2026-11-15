import { Skeleton } from "@repo/ui/components/skeleton";

import { getCells, getLatestRun } from "@/features/bowls/bowls-queries";
import { AreaCheckMap } from "@/features/check/components/area-check-map";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function AreaCheck({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const [cells, run] = await Promise.all([getCells(), getLatestRun()]);
  const coarseCells = cells.map((cell) => ({
    ...cell,
    sinkingMmYr: cell.sinkingMmYr === null ? null : Math.round(cell.sinkingMmYr),
    uncertaintyMmYr: null,
    people: null,
  }));
  return (
    <AreaCheckMap
      cells={coarseCells}
      cellSizeM={run?.cellSizeM ?? 480}
      labels={{ check: dictionary.check, common: dictionary.common }}
    />
  );
}

export function AreaCheckSkeleton() {
  return <Skeleton className="min-h-96 flex-1" />;
}
