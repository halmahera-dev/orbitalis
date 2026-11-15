import { Analytics01Icon, ArrowRight02Icon, FileSearchIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import { getBowlSeries, getBowls, getNisarLeads, type Bowl } from "@/features/bowls/bowls-queries";
import {
  fastestMeasuredSinking,
  type MeasuredSinkingSite,
} from "@/features/nisar/measured-sinking";
import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { nisarRateForBowl } from "@/features/nisar/nisar-queries";
import { Sparkline } from "@/features/today/components/sparkline";
import { PassChart } from "@/features/today/components/today-charts";
import { TodayMiniMapLazy } from "@/features/today/components/today-mini-map-lazy";
import {
  Card,
  CountList,
  Dumbbells,
  Metric,
  SplitRows,
} from "@/features/today/components/today-panels";
import { fill, formatDate, getDictionary, type Dictionary, type Locale } from "@/lib/i18n";

const passIntervalDays = 12;
const notSlowingShare = 0.8;
const slowingShare = 0.6;
const banEffectLimit = 8;
const mapPinLimit = 8;

const statusColors: Record<Bowl["status"], string> = {
  lead: "bg-brand",
  scheduled: "bg-chart-2",
  inspected: "bg-chart-3",
  closed: "bg-chart-5",
  dismissed: "bg-muted-foreground/40",
};

type ChangeKind = "new" | "up" | "down" | "slowing";

function rateShare(bowl: Bowl) {
  return bowl.rateAfterBanMmYr / bowl.rateBeforeBanMmYr;
}

function describeChange(bowl: Bowl, latestPassIndex: number, t: Dictionary["today"]) {
  if (bowl.firstSeenPass === latestPassIndex) {
    return { kind: "new" as ChangeKind, text: t.newBowl };
  }
  if (bowl.previousRank !== null && bowl.previousRank > bowl.rank) {
    return {
      kind: "up" as ChangeKind,
      text: fill(t.rankUp, { from: bowl.previousRank, to: bowl.rank }),
    };
  }
  if (bowl.previousRank !== null && bowl.previousRank < bowl.rank) {
    return {
      kind: "down" as ChangeKind,
      text: fill(t.rankDown, { from: bowl.previousRank, to: bowl.rank }),
    };
  }
  if (rateShare(bowl) < slowingShare) {
    return {
      kind: "slowing" as ChangeKind,
      text: fill(t.slowing, { percent: Math.round((1 - rateShare(bowl)) * 100) }),
    };
  }
  return null;
}

function RankChange({ bowl, kind, text }: { bowl: Bowl; kind: ChangeKind; text: string }) {
  const hasMoved = kind !== "slowing";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums" title={text}>
      <span className="sr-only">{text}</span>
      {hasMoved ? (
        <span aria-hidden="true" className="text-muted-foreground">
          {bowl.previousRank ?? "–"}
        </span>
      ) : null}
      {hasMoved ? (
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          strokeWidth={2}
          className="size-3 text-muted-foreground"
          aria-hidden="true"
        />
      ) : null}
      <span
        aria-hidden="true"
        className={cn("font-medium", kind === "down" ? null : "text-brand-text")}
      >
        {bowl.rank}
      </span>
    </span>
  );
}

function measuredVerticalSeries(bowlId: string) {
  const rate = nisarRateForBowl(bowlId);
  if (!rate.measured || rate.series.length === 0) {
    return null;
  }
  return rate.series.map((point) => ({ date: point.date, mm: -point.mm }));
}

function measuredBowlSite(bowl: Pick<Bowl, "id" | "name">): MeasuredSinkingSite | null {
  const rate = nisarRateForBowl(bowl.id);
  if (!rate.measured) {
    return null;
  }
  return {
    id: bowl.id,
    name: bowl.name,
    rateMmYr: rate.verticalRateMmYr,
    kind: "bowl",
    seriesDownMm: rate.series.map((point) => -point.mm),
  };
}

function measuredSiteHref(locale: Locale, site: MeasuredSinkingSite) {
  if (site.kind === "candidate") {
    return `/${locale}/map?show=leads&lead=${encodeURIComponent(site.id)}`;
  }
  return `/${locale}/bowls/${site.id}`;
}

function meanByIndex(seriesList: { mm: number }[][]) {
  if (seriesList.length === 0) {
    return [];
  }
  const length = Math.min(...seriesList.map((series) => series.length));
  return Array.from({ length }, (_, index) => {
    const total = seriesList.reduce((sum, series) => sum + series[index].mm, 0);
    return Math.round(total / seriesList.length);
  });
}

function InsightText({
  template,
  values,
}: {
  template: string;
  values: Record<string, string | number>;
}) {
  return (
    <>
      {fill(template, values)
        .split("**")
        .map((part, index) =>
          index % 2 === 1 ? (
            <strong key={`${part}-${index}`} className="font-semibold text-foreground">
              {part}
            </strong>
          ) : (
            <span key={`${part}-${index}`}>{part}</span>
          ),
        )}
    </>
  );
}

export async function TodayOverview({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const t = dictionary.today;
  const [bowls, nisarLeads] = await Promise.all([getBowls(), getNisarLeads()]);
  const activeBowls = bowls.filter((bowl) => bowl.status !== "dismissed");
  const bowlsBySpeed = activeBowls.toSorted((a, b) => b.rateAfterBanMmYr - a.rateAfterBanMmYr);
  const measuredSites: MeasuredSinkingSite[] = [
    ...activeBowls.flatMap((bowl) => {
      const site = measuredBowlSite(bowl);
      return site ? [site] : [];
    }),
    ...nisarLeads
      .filter((lead) => lead.status !== "dismissed")
      .map((lead) => ({
        id: lead.id,
        name: lead.name,
        rateMmYr: lead.rateMmYr,
        kind: "candidate" as const,
        seriesDownMm: [],
      })),
  ];
  const fastestMeasured = fastestMeasuredSinking(measuredSites);
  const fastestMeasuredRate = fastestMeasured ? Math.round(fastestMeasured.rateMmYr) : null;
  const notSlowingCount = activeBowls.filter((bowl) => rateShare(bowl) >= notSlowingShare).length;
  const notSlowingPercent = Math.round((notSlowingCount / Math.max(activeBowls.length, 1)) * 100);
  const closedBowls = bowls.filter((bowl) => bowl.outcome !== null);
  const pumpCount = closedBowls.filter((bowl) => bowl.outcome === "pump_found").length;
  const bowlsPath = `/${locale}/bowls`;

  const pairs = interferogramCatalog.pairs;
  const latestPassIndex = pairs.length - 1;
  const latestPassDate = pairs[latestPassIndex].secondaryDate;
  const nextPassDate = new Date(Date.parse(latestPassDate) + passIntervalDays * 86_400_000);
  const nextPassTemplate = nextPassDate.getTime() > Date.now() ? t.nextPassFuture : t.nextPassLate;

  const seriesList = activeBowls.flatMap((bowl) => {
    const series = getBowlSeries(bowl.id);
    return series ? [series] : [];
  });
  const measuredSeries = activeBowls.flatMap((bowl) => {
    const series = measuredVerticalSeries(bowl.id);
    return series ? [series] : [];
  });
  const nisarDates = measuredSeries[0]?.map((point) => point.date) ?? [];
  const passPoints = meanByIndex(measuredSeries).map((mm, index) => ({
    label: formatDate(locale, nisarDates[index]),
    mm,
  }));
  const meanSentinel = meanByIndex(seriesList.map((series) => series.sentinel1));
  const fastestSeries = fastestMeasured?.seriesDownMm ?? [];
  const knownByPass = pairs.map(
    (_, passIndex) => activeBowls.filter((bowl) => bowl.firstSeenPass <= passIndex).length,
  );

  const changes = bowls.flatMap((bowl) => {
    const change = describeChange(bowl, latestPassIndex, t);
    return change ? [{ bowl, ...change }] : [];
  });

  const kecamatanRows = Object.entries(Object.groupBy(activeBowls, (bowl) => bowl.kecamatan))
    .map(([name, group]) => ({
      key: name,
      label: name,
      count: group?.length ?? 0,
      href: `${bowlsPath}?kecamatan=${encodeURIComponent(name)}`,
    }))
    .toSorted((a, b) => b.count - a.count);

  const banEffectRows = bowlsBySpeed.slice(0, banEffectLimit).map((bowl) => ({
    key: bowl.id,
    label: bowl.name,
    detail: bowl.kecamatan,
    before: bowl.rateBeforeBanMmYr,
    after: bowl.rateAfterBanMmYr,
    href: `${bowlsPath}/${bowl.id}`,
  }));

  const unit = dictionary.common.mmPerYear;
  const hasHitRate = closedBowls.length > 0;

  return (
    <div className="flex flex-col gap-3">
      <section
        aria-labelledby="overview-insight"
        className="flex min-w-0 flex-col gap-3 insight-card p-4"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <HugeiconsIcon icon={Analytics01Icon} strokeWidth={2} className="size-4" />
          <h2 id="overview-insight" className="flex-1">
            {t.insightTitle}
          </h2>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex" />}>
              <Button
                variant="ghost"
                size="icon-sm"
                nativeButton={false}
                aria-label={t.insightLeads}
                render={<Link href={`${bowlsPath}?status=lead`} />}
              >
                <HugeiconsIcon icon={FileSearchIcon} strokeWidth={2} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.insightLeads}</TooltipContent>
          </Tooltip>
        </div>
        <p className="type-title text-xl text-muted-foreground">
          <InsightText template={t.insightBody} values={{ share: notSlowingPercent }} />
          {fastestMeasured && fastestMeasuredRate !== null ? (
            <>
              {" "}
              <InsightText
                template={t.insightMeasured}
                values={{ name: fastestMeasured.name, rate: fastestMeasuredRate }}
              />
            </>
          ) : null}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={t.activeBowls} value={String(activeBowls.length)} href={bowlsPath}>
          <Sparkline values={knownByPass} color="var(--chart-2)" isStep />
        </Metric>
        <Metric
          label={t.worstRate}
          value={fastestMeasuredRate !== null ? `${fastestMeasuredRate} ${unit}` : "—"}
          detail={fastestMeasured?.name}
          href={fastestMeasured ? measuredSiteHref(locale, fastestMeasured) : bowlsPath}
        >
          <Sparkline values={fastestSeries} color="var(--brand)" />
        </Metric>
        <Metric
          label={t.notSlowing}
          value={`${notSlowingPercent}%`}
          detail={`${notSlowingCount} / ${activeBowls.length}`}
          href={bowlsPath}
        >
          <Sparkline values={meanSentinel} color="var(--chart-4)" />
        </Metric>
        <Metric
          label={t.hitRate}
          value={hasHitRate ? `${pumpCount} / ${closedBowls.length}` : "—"}
          detail={hasHitRate ? null : t.noOutcomes}
          href={hasHitRate ? `${bowlsPath}?status=closed` : `${bowlsPath}?status=lead`}
        >
          {hasHitRate ? (
            <ol className="flex flex-wrap gap-1 px-4 pb-4" aria-hidden="true">
              {closedBowls.map((bowl) => (
                <li
                  key={bowl.id}
                  className={cn(
                    "size-2.5 rounded-full",
                    bowl.outcome === "pump_found" ? "bg-brand" : "bg-muted-foreground/30",
                  )}
                />
              ))}
            </ol>
          ) : (
            <p className="px-4 pb-4 text-xs text-muted-foreground">{t.noHitRateNext}</p>
          )}
        </Metric>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
        <div className="h-full min-h-56 xl:col-span-2">
          <TodayMiniMapLazy
            locale={locale}
            bowls={bowlsBySpeed.slice(0, mapPinLimit)}
            title={t.mapCardTitle}
            openLabel={t.openMapCard}
          />
        </div>
        <Card id="changes" title={t.changes} note={t.sinceLastPass} className="h-full">
          {changes.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.noChanges}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dictionary.bowls.bowl}</TableHead>
                  <TableHead>{dictionary.bowls.rank}</TableHead>
                  <TableHead className="text-right">{dictionary.bowls.rate}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((change) => (
                  <TableRow key={change.bowl.id}>
                    <TableCell>
                      <Link
                        href={`${bowlsPath}/${change.bowl.id}`}
                        prefetch={false}
                        className="flex flex-col transition-colors duration-160 ease-out hover:text-brand-text"
                      >
                        <span className="font-medium">{change.bowl.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {change.bowl.kecamatan}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <RankChange bowl={change.bowl} kind={change.kind} text={change.text} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-flex items-baseline gap-1.5 tabular-nums">
                        {change.bowl.rateAfterBanMmYr}
                        <span className="text-xs text-muted-foreground">
                          {Math.round((rateShare(change.bowl) - 1) * 100)}%
                        </span>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      <Card
        id="ban-effect"
        title={t.banEffect}
        note={bowlsBySpeed.length > banEffectLimit ? undefined : t.banEffectNote}
        action={
          bowlsBySpeed.length > banEffectLimit ? (
            <Link
              href={bowlsPath}
              className="text-xs text-brand-text transition-colors duration-160 ease-out hover:text-foreground"
            >
              {t.seeAll}
            </Link>
          ) : undefined
        }
      >
        <Dumbbells rows={banEffectRows} beforeLabel={t.rateBefore} afterLabel={t.rateNow} />
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card id="case-status" title={t.caseStatus}>
          <SplitRows
            rows={(Object.keys(statusColors) as Bowl["status"][]).map((status) => ({
              label: dictionary.bowls.statuses[status],
              value: bowls.filter((bowl) => bowl.status === status).length,
              color: statusColors[status],
              href: `${bowlsPath}?status=${status}`,
            }))}
          />
        </Card>
        <Card id="by-kecamatan" title={t.byKecamatan}>
          <CountList rows={kecamatanRows} emptyMessage={dictionary.bowls.empty} />
        </Card>
      </div>

      <Card id="heartbeat" title={t.heartbeat} note={t.movementNote}>
        <PassChart points={passPoints} label={t.meanMovement} />
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p>
            {fill(t.latestPass, { date: formatDate(locale, latestPassDate) })}{" "}
            <span className="text-muted-foreground">
              {fill(nextPassTemplate, { date: formatDate(locale, nextPassDate) })}
            </span>
          </p>
          <ol
            className="flex items-center gap-1.5"
            aria-label={fill(t.passCount, { count: pairs.length })}
          >
            {pairs.map((pair, index) => (
              <li
                key={pair.id}
                title={formatDate(locale, pair.secondaryDate)}
                className={cn(
                  "size-2 rounded-full",
                  index === latestPassIndex ? "bg-brand" : "bg-muted-foreground/40",
                )}
              >
                <span className="sr-only">{formatDate(locale, pair.secondaryDate)}</span>
              </li>
            ))}
            <li
              className="size-2 rounded-full border border-dashed border-muted-foreground"
              aria-hidden
            />
          </ol>
        </div>
      </Card>
    </div>
  );
}

export function TodayOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      <Skeleton className="h-28 w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Skeleton className="h-64 xl:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-96" />
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
