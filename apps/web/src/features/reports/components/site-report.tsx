import type { ReactNode } from "react";

import {
  Alert02Icon,
  Calendar03Icon,
  DashboardSpeed01Icon,
  DropletsIcon,
  File01Icon,
  Location01Icon,
  PipelineIcon,
  Satellite01Icon,
  Target01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Skeleton } from "@repo/ui/components/skeleton";
import Link from "next/link";

import { InsightCard, type InsightSentence } from "@/components/insight-card";
import { cellAt, getBowls, getCells, getLatestRun } from "@/features/bowls/bowls-queries";
import { RateRange } from "@/features/bowls/components/rate-range";
import { isFarmingSite } from "@/features/bowls/visit";
import { rateClass } from "@/features/map/bowl-rates";
import { peoplePerKm2, unservedPeople } from "@/features/plans/plan-scores";
import { getPlanEntries } from "@/features/plans/plans-queries";
import { PrintButton } from "@/features/reports/components/print-button";
import { requireSession } from "@/features/user/user-queries";
import { fill, formatDate, formatNumber, getDictionary, type Locale } from "@/lib/i18n";

const currentYear = 2026;
const projectionYears = [2035, 2050];
const metersPerDegree = 111_320;

type Icon = typeof Target01Icon;

function distanceKm([lon1, lat1]: [number, number], [lon2, lat2]: [number, number]) {
  const east = (lon2 - lon1) * metersPerDegree * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180);
  return Math.hypot(east, (lat2 - lat1) * metersPerDegree) / 1000;
}

function nearest<T extends { center: [number, number] }>(items: T[], point: [number, number]) {
  return (
    items
      .map((item) => ({ item, km: distanceKm(item.center, point) }))
      .toSorted((a, b) => a.km - b.km)[0] ?? null
  );
}

function Tile({ icon, label, value }: { icon: Icon; label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-3xl bg-card p-4 shadow-card print:border print:shadow-none">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={icon} strokeWidth={2} className="size-4 shrink-0" />
        {label}
      </span>
      <span className="type-title text-xl tabular-nums">{value}</span>
    </div>
  );
}

function Row({ icon, label, value }: { icon: Icon; label: string; value: ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-2.5 text-sm">
      <HugeiconsIcon
        icon={icon}
        strokeWidth={2}
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <span className="flex-1">{label}</span>
      <span className="text-right text-muted-foreground tabular-nums">{value}</span>
    </li>
  );
}

export async function SiteReport({
  locale,
  point,
}: {
  locale: Locale;
  point: [number, number] | null;
}) {
  await requireSession(locale);
  const dictionary = getDictionary(locale);
  const t = dictionary.report;
  const [run, cells, bowls, planEntries] = await Promise.all([
    getLatestRun(),
    getCells(),
    getBowls(),
    getPlanEntries(),
  ]);
  const cell = point && run ? cellAt(point, cells, run.cellSizeM) : null;

  if (!point || !run || !cell || cell.sinkingMmYr === null) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-3xl bg-card p-6 shadow-card">
        <p className="text-sm text-muted-foreground">{t.noData}</p>
        <Link href={`/${locale}/map?show=sinking`} className="text-sm text-brand-text">
          {dictionary.common.openMap}
        </Link>
      </div>
    );
  }

  const rate = cell.sinkingMmYr;
  const spread = cell.uncertaintyMmYr ?? 0;
  const density = peoplePerKm2(cell, run.cellSizeM);
  const unserved = unservedPeople(cell);
  const lead = nearest(
    bowls.filter((bowl) => !isFarmingSite(bowl)),
    point,
  );
  const site = nearest(bowls.filter(isFarmingSite), point);
  const plans = planEntries.filter((entry) => entry.cellId === cell.id);
  const unit = dictionary.common.mmPerYear;
  const insightYear = projectionYears[0];
  const insightSentences: InsightSentence[] = [
    rate > 0
      ? {
          template: t.insight,
          values: {
            rate: Math.round(rate),
            unit,
            cm: Math.round((rate * (insightYear - currentYear)) / 10),
            year: insightYear,
          },
        }
      : { template: t.insightStable },
  ];
  if (lead) {
    insightSentences.push({
      template: t.insightLead,
      values: { name: lead.item.name, km: lead.km.toFixed(1) },
    });
  }

  return (
    <article className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="type-title text-2xl">{t.title}</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
            <HugeiconsIcon icon={Location01Icon} strokeWidth={2} className="size-4" />
            {point[1].toFixed(5)}, {point[0].toFixed(5)}
            <span>{fill(t.cell, { id: cell.id, size: run.cellSizeM })}</span>
          </p>
        </div>
        <PrintButton label={t.print} />
      </header>

      <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-card print:border print:shadow-none">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t.sinking}</span>
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs">
            {t.classes[rateClass(rate)]}
          </span>
        </div>
        <p className="type-title text-3xl tabular-nums">
          {Math.round(rate)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            ±{Math.round(spread)} {unit}
          </span>
        </p>
        <RateRange
          rateMmYr={Math.max(rate, 0)}
          uncertaintyMmYr={spread}
          maxMmYr={Math.max(100, rate + spread)}
          label={fill(dictionary.map.rateValue, {
            rate: Math.round(rate),
            uncertainty: Math.round(spread),
          })}
        />
        <p className="text-xs text-muted-foreground">{dictionary.map.relativeNote}</p>
      </section>

      <InsightCard title={dictionary.common.insight} sentences={insightSentences} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {projectionYears.map((year) => (
          <Tile
            key={year}
            icon={Calendar03Icon}
            label={fill(t.deeperBy, { year })}
            value={`${Math.round((Math.max(rate, 0) * (year - currentYear)) / 10)} cm`}
          />
        ))}
        <Tile
          icon={UserGroupIcon}
          label={dictionary.map.stats.people}
          value={density === null ? "—" : formatNumber(locale, Math.round(density))}
        />
        <Tile
          icon={PipelineIcon}
          label={t.withoutPipes}
          value={unserved === null ? "—" : `≈${formatNumber(locale, unserved)}`}
        />
      </div>

      <section className="rounded-3xl bg-card px-4 py-2 shadow-card print:border print:shadow-none">
        <h3 className="pt-2 text-sm font-medium">{t.around}</h3>
        <ul className="flex flex-col divide-y">
          <Row
            icon={Target01Icon}
            label={lead ? fill(t.nearestLead, { name: lead.item.name }) : t.noLead}
            value={lead ? `${lead.km.toFixed(1)} km` : "—"}
          />
          <Row
            icon={DropletsIcon}
            label={site ? fill(t.nearestSite, { name: site.item.name }) : t.noSite}
            value={site ? `${site.km.toFixed(1)} km` : "—"}
          />
          {plans.map((entry) => (
            <Row
              key={entry.kind}
              icon={entry.kind === "pipe" ? PipelineIcon : DropletsIcon}
              label={dictionary.map.plan.title[entry.kind]}
              value={dictionary.map.plan.statuses[entry.status]}
            />
          ))}
          <Row
            icon={Satellite01Icon}
            label={dictionary.map.cell.coverage}
            value={`${Math.round(cell.coveredShare * 100)}%`}
          />
        </ul>
      </section>

      <section className="rounded-3xl bg-card px-4 py-2 shadow-card print:border print:shadow-none">
        <h3 className="pt-2 text-sm font-medium">{t.rulesTitle}</h3>
        <ul className="flex flex-col divide-y">
          <Row icon={File01Icon} label={t.rules.permit} value={t.rules.permitSource} />
          <Row icon={DropletsIcon} label={t.rules.farming} value={t.rules.farmingSource} />
          <Row icon={DashboardSpeed01Icon} label={t.rules.zones} value={t.rules.zonesSource} />
        </ul>
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 shrink-0" />
        {fill(t.disclaimer, {
          start: formatDate(locale, run.periodStart),
          end: formatDate(locale, run.periodEnd),
        })}
      </p>
    </article>
  );
}

export function SiteReportSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-36" />
      <Skeleton className="h-24" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}
