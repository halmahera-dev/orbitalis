import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import Link from "next/link";

import { InsightCard, type InsightSentence } from "@/components/insight-card";
import { getBowls, getLatestRun, type Bowl } from "@/features/bowls/bowls-queries";
import { RateRange } from "@/features/bowls/components/rate-range";
import { isFarmingSite, statusDotColors } from "@/features/bowls/visit";
import { interferogramCatalog } from "@/features/nisar/nisar-catalog";
import { planKinds, planStatuses } from "@/features/plans/plan-scores";
import { getPlanEntries } from "@/features/plans/plans-queries";
import { Sparkline } from "@/features/today/components/sparkline";
import { PassChart } from "@/features/today/components/today-charts";
import { TodayMiniMapLazy } from "@/features/today/components/today-mini-map-lazy";
import { Card, CountList, Metric, SplitRows } from "@/features/today/components/today-panels";
import { fill, formatDate, formatNumber, getDictionary, type Locale } from "@/lib/i18n";

const passIntervalDays = 12;
const triageLimit = 6;

function meanSeries(bowls: Bowl[]) {
  const withSeries = bowls.filter((bowl) => bowl.series.length > 0);
  if (withSeries.length === 0) {
    return [];
  }
  const length = Math.min(...withSeries.map((bowl) => bowl.series.length));
  return Array.from({ length }, (_, index) => ({
    date: withSeries[0].series[index].date,
    mm: Math.round(
      withSeries.reduce((sum, bowl) => sum - bowl.series[index].mm, 0) / withSeries.length,
    ),
  }));
}

export async function TodayOverview({ locale }: { locale: Locale }) {
  const dictionary = getDictionary(locale);
  const t = dictionary.today;
  const unit = dictionary.common.mmPerYear;
  const [everyBowl, run, planEntries] = await Promise.all([
    getBowls(),
    getLatestRun(),
    getPlanEntries(),
  ]);
  const bowls = everyBowl.filter((bowl) => !isFarmingSite(bowl));
  const sites = everyBowl.filter(isFarmingSite);
  const activeBowls = bowls.filter((bowl) => bowl.status !== "dismissed");
  const openLeads = activeBowls.filter((bowl) => bowl.status === "lead");
  const fastest = activeBowls
    .filter((bowl) => bowl.rateMmYr !== null)
    .toSorted((a, b) => (b.rateMmYr ?? 0) - (a.rateMmYr ?? 0))[0];
  const closedBowls = bowls.filter((bowl) => bowl.outcome !== null);
  const pumpCount = closedBowls.filter((bowl) => bowl.outcome === "pump_found").length;
  const mostPeople = activeBowls.reduce<Bowl | null>(
    (best, bowl) => ((bowl.peoplePerKm2 ?? 0) > (best?.peoplePerKm2 ?? -1) ? bowl : best),
    null,
  );
  const bowlsPath = `/${locale}/bowls`;
  const mapPath = `/${locale}/map`;

  const pairs = interferogramCatalog.pairs;
  const latestPassDate = run?.periodEnd ?? pairs[pairs.length - 1].secondaryDate;
  const nextPassDate = new Date(Date.parse(latestPassDate) + passIntervalDays * 86_400_000);
  const nextPassTemplate = nextPassDate.getTime() > Date.now() ? t.nextPassFuture : t.nextPassLate;
  const passPoints = meanSeries(activeBowls).map((point) => ({
    label: formatDate(locale, point.date),
    mm: point.mm,
  }));
  const triage = openLeads.slice(0, triageLimit);
  const maxRate = Math.max(
    1,
    ...triage.map((bowl) => (bowl.rateMmYr ?? 0) + (bowl.uncertaintyMmYr ?? 0)),
  );

  const kecamatanRows = Object.entries(
    Object.groupBy(activeBowls, (bowl) => bowl.kecamatan || t.unnamedArea),
  )
    .map(([name, group]) => ({
      key: name,
      label: name,
      count: group?.length ?? 0,
      href: `${bowlsPath}?kecamatan=${encodeURIComponent(name)}`,
    }))
    .toSorted((a, b) => b.count - a.count);

  const insightSentences: InsightSentence[] = [
    openLeads.length > 0
      ? {
          template: t.insightLeads,
          values: { open: openLeads.length, total: activeBowls.length },
        }
      : { template: t.insightNoLeads },
  ];
  if (fastest?.rateMmYr != null) {
    insightSentences.push({
      template: t.insightFastest,
      values: { name: fastest.name, rate: Math.round(fastest.rateMmYr), unit },
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <InsightCard title={dictionary.common.insight} sentences={insightSentences} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label={t.openLeads}
          value={String(openLeads.length)}
          detail={`/ ${activeBowls.length}`}
          href={`${bowlsPath}?status=lead`}
        />
        <Metric
          label={t.worstRate}
          value={fastest?.rateMmYr != null ? `${Math.round(fastest.rateMmYr)} ${unit}` : "—"}
          detail={fastest?.name}
          href={fastest ? `${bowlsPath}/${fastest.id}` : bowlsPath}
        >
          {fastest && fastest.series.length > 1 ? (
            <Sparkline values={fastest.series.map((point) => -point.mm)} color="var(--brand)" />
          ) : null}
        </Metric>
        <Metric
          label={t.mostPeople}
          value={
            mostPeople?.peoplePerKm2 != null ? formatNumber(locale, mostPeople.peoplePerKm2) : "—"
          }
          detail={mostPeople ? fill(t.perKm2At, { name: mostPeople.name }) : null}
          href={mostPeople ? `${bowlsPath}/${mostPeople.id}` : bowlsPath}
        />
        <Metric
          label={t.hitRate}
          value={closedBowls.length > 0 ? `${pumpCount} / ${closedBowls.length}` : "—"}
          href={closedBowls.length > 0 ? `${bowlsPath}?status=closed` : `${bowlsPath}?status=lead`}
        >
          {closedBowls.length > 0 ? (
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
          ) : null}
        </Metric>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
        <div className="h-full min-h-56 xl:col-span-2">
          <TodayMiniMapLazy
            locale={locale}
            bowls={activeBowls}
            title={t.mapCardTitle}
            openLabel={t.openMapCard}
          />
        </div>
        <Card
          id="triage"
          title={t.triage}
          action={
            <Link
              href={`${mapPath}?show=leads`}
              className="text-xs text-brand-text transition-colors duration-160 ease-out hover:text-foreground"
            >
              {t.openTriage}
            </Link>
          }
          className="h-full"
        >
          {triage.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t.noLeads}</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {triage.map((bowl) => (
                <li key={bowl.id}>
                  <Link
                    href={`${bowlsPath}/${bowl.id}`}
                    prefetch={false}
                    className="flex items-center gap-3 text-sm transition-colors duration-160 ease-out hover:text-brand-text"
                  >
                    <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                      {bowl.rank}
                    </span>
                    <span className="w-28 min-w-0 shrink-0 truncate">{bowl.name}</span>
                    {bowl.rateMmYr !== null ? (
                      <RateRange
                        rateMmYr={bowl.rateMmYr}
                        uncertaintyMmYr={bowl.uncertaintyMmYr}
                        maxMmYr={maxRate}
                        label={fill(dictionary.map.rateValue, {
                          rate: Math.round(bowl.rateMmYr),
                          uncertainty: Math.round(bowl.uncertaintyMmYr ?? 0),
                        })}
                      />
                    ) : (
                      <span className="flex-1" />
                    )}
                    <span className="w-10 shrink-0 text-right tabular-nums">
                      {bowl.rateMmYr === null ? "—" : Math.round(bowl.rateMmYr)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card id="case-status" title={t.caseStatus}>
          <SplitRows
            rows={(Object.keys(statusDotColors) as Bowl["status"][]).map((status) => ({
              label: dictionary.bowls.statuses[status],
              value: bowls.filter((bowl) => bowl.status === status).length,
              color: statusDotColors[status],
              href: `${bowlsPath}?status=${status}`,
            }))}
          />
        </Card>
        <Card id="by-kecamatan" title={t.byKecamatan}>
          <CountList rows={kecamatanRows} emptyMessage={dictionary.bowls.empty} />
        </Card>
        <Card
          id="water-farming"
          title={fill(t.farmingSites, { count: sites.length })}
          action={
            <Link
              href={`${mapPath}?show=farming`}
              className="text-xs text-brand-text transition-colors duration-160 ease-out hover:text-foreground"
            >
              {t.openMapCard}
            </Link>
          }
        >
          <SplitRows
            rows={(["lead", "scheduled", "closed", "dismissed"] as const).map((status) => ({
              label: dictionary.map.farming.statuses[status],
              value: sites.filter((site) =>
                status === "closed"
                  ? site.status === "closed" || site.status === "inspected"
                  : site.status === status,
              ).length,
              color: statusDotColors[status],
              href: `${bowlsPath}?type=farming&status=${status}`,
            }))}
          />
        </Card>
        <Card id="plans" title={t.plans}>
          {planKinds.map((kind) => {
            const entries = planEntries.filter((entry) => entry.kind === kind);
            return (
              <div key={kind} className="flex flex-col gap-2">
                <Link
                  href={`${mapPath}?show=${kind === "pipe" ? "people" : "sinking"}`}
                  className="flex items-baseline justify-between text-sm transition-colors duration-160 ease-out hover:text-brand-text"
                >
                  <span>{dictionary.map.plan.title[kind]}</span>
                  <span className="tabular-nums">{entries.length}</span>
                </Link>
                <ol className="flex gap-1" aria-hidden="true">
                  {planStatuses.map((status) => (
                    <li
                      key={status}
                      title={dictionary.map.plan.statuses[status]}
                      className={cn(
                        "h-1.5 flex-1 rounded-full",
                        entries.some((entry) => entry.status === status)
                          ? "bg-brand"
                          : "bg-muted-foreground/15",
                      )}
                    />
                  ))}
                </ol>
              </div>
            );
          })}
        </Card>
      </div>

      <Card id="heartbeat" title={t.heartbeat}>
        {passPoints.length > 1 ? <PassChart points={passPoints} label={t.meanMovement} /> : null}
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
                  index === pairs.length - 1 ? "bg-brand" : "bg-muted-foreground/40",
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
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-3 xl:grid-cols-3">
        <Skeleton className="h-64 xl:col-span-2" />
        <Skeleton className="h-64" />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}
