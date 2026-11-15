"use client";

import {
  Alert02Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Flag01Icon,
  Satellite01Icon,
  SignalFull02Icon,
  Target01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import Link from "next/link";
import { useEffect, useEffectEvent, useTransition, type ReactNode } from "react";
import { toast } from "sonner";

import type { Bowl, Cell } from "@/features/bowls/bowls-queries";

import { flagCell } from "@/features/bowls/bowls-actions";
import { RateRange } from "@/features/bowls/components/rate-range";
import { statusDotColors } from "@/features/bowls/visit";
import { Sparkline } from "@/features/today/components/sparkline";
import { fill, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type PanelLabels = {
  map: Dictionary["map"];
  common: Dictionary["common"];
  statuses: Dictionary["bowls"]["statuses"];
};

type Icon = typeof Cancel01Icon;

function Panel({
  title,
  subtitle,
  headerAction,
  closeLabel,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  headerAction?: ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <section
      aria-label={title}
      className="absolute right-4 bottom-4 left-4 flex max-h-96 fade-in flex-col gap-4 overflow-y-auto rounded-4xl border border-transparent glass p-4 text-sm shadow-md md:top-4 md:bottom-auto md:left-auto md:max-h-128 md:w-80"
    >
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate type-title">{title}</h2>
          {subtitle ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {headerAction}
        <Button size="icon-sm" variant="ghost" aria-label={closeLabel} onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </div>
      {children}
    </section>
  );
}

function Stat({ icon, label, value }: { icon: Icon; label: string; value: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-muted/60 p-2.5" />}
      >
        <HugeiconsIcon
          icon={icon}
          strokeWidth={2}
          className="size-4 text-muted-foreground"
          aria-hidden="true"
        />
        <span className="truncate tabular-nums">{value}</span>
        <span className="sr-only">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Chip({ icon, children }: { icon?: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
      {icon ? <HugeiconsIcon icon={icon} strokeWidth={2} className="size-3.5" /> : null}
      {children}
    </span>
  );
}

function RateHeadline({
  rateMmYr,
  uncertaintyMmYr,
  labels,
}: {
  rateMmYr: number | null;
  uncertaintyMmYr: number | null;
  labels: PanelLabels;
}) {
  const t = labels.map;
  if (rateMmYr === null) {
    return <p className="text-muted-foreground">{t.noRadarData}</p>;
  }
  const rateText = fill(t.rateValue, {
    rate: Math.round(rateMmYr),
    uncertainty: Math.round(uncertaintyMmYr ?? 0),
  });
  return (
    <div className="flex flex-col gap-2">
      <p className="type-title text-2xl tabular-nums">
        {Math.round(rateMmYr)}
        <span className="ml-1 text-sm font-normal text-muted-foreground">
          ±{Math.round(uncertaintyMmYr ?? 0)} {labels.common.mmPerYear}
        </span>
      </p>
      <RateRange
        rateMmYr={rateMmYr}
        uncertaintyMmYr={uncertaintyMmYr}
        maxMmYr={Math.max(100, rateMmYr + (uncertaintyMmYr ?? 0))}
        label={rateText}
      />
      <p className="text-xs text-muted-foreground">{t.relativeNote}</p>
    </div>
  );
}

export function BowlPanel({
  locale,
  bowl,
  actions,
  labels,
  onClose,
}: {
  locale: Locale;
  bowl: Bowl;
  actions: ReactNode;
  labels: PanelLabels;
  onClose: () => void;
}) {
  const t = labels.map;
  const series = bowl.series.map((point) => -point.mm);

  return (
    <Panel
      title={bowl.name}
      subtitle={bowl.kecamatan}
      closeLabel={labels.common.close}
      onClose={onClose}
      headerAction={
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={t.openBowl}
                nativeButton={false}
                render={<Link href={`/${locale}/bowls/${bowl.id}`} />}
              />
            }
          >
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} />
          </TooltipTrigger>
          <TooltipContent>{t.openBowl}</TooltipContent>
        </Tooltip>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        <Chip>
          <span className={cn("size-2 rounded-full", statusDotColors[bowl.status])} />
          {labels.statuses[bowl.status]}
        </Chip>
        {bowl.source === "manual" ? (
          <Chip icon={Flag01Icon}>{t.legend.manual}</Chip>
        ) : (
          <Chip icon={Satellite01Icon}>
            {bowl.isOneTrack ? t.legend.oneTrack : t.legend.twoTracks}
          </Chip>
        )}
      </div>

      <RateHeadline
        rateMmYr={bowl.rateMmYr}
        uncertaintyMmYr={bowl.uncertaintyMmYr}
        labels={labels}
      />

      {series.length > 1 ? (
        <Sparkline values={series} color="var(--brand)" className="h-10" />
      ) : null}

      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={SignalFull02Icon}
          label={t.stats.signal}
          value={bowl.snr === null ? "—" : `×${bowl.snr}`}
        />
        <Stat icon={Target01Icon} label={t.stats.radius} value={`${bowl.radiusM} m`} />
        <Stat
          icon={UserGroupIcon}
          label={t.stats.people}
          value={bowl.peoplePerKm2 === null ? "—" : formatNumber(locale, bowl.peoplePerKm2)}
        />
      </div>

      {actions}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4 shrink-0" />
        {t.leadShort}
      </p>
    </Panel>
  );
}

export function CellPanel({
  locale,
  cell,
  cellSizeM,
  nearestLead,
  labels,
  onClose,
  onSelectBowl,
}: {
  locale: Locale;
  cell: Cell;
  cellSizeM: number;
  nearestLead: { bowl: Bowl; distanceKm: number } | null;
  labels: PanelLabels;
  onClose: () => void;
  onSelectBowl: (bowlId: string) => void;
}) {
  const t = labels.map;
  const [isFlagging, startFlagging] = useTransition();
  const areaKm2 = (cellSizeM / 1000) ** 2;

  function flag() {
    startFlagging(async () => {
      const result = await flagCell(cell.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t.cell.flagged);
      onSelectBowl(result.bowlId);
    });
  }

  return (
    <Panel
      title={fill(t.cell.title, { id: cell.id })}
      subtitle={fill(t.cell.size, { size: cellSizeM })}
      closeLabel={labels.common.close}
      onClose={onClose}
    >
      <RateHeadline
        rateMmYr={cell.sinkingMmYr}
        uncertaintyMmYr={cell.uncertaintyMmYr}
        labels={labels}
      />

      <div className="grid grid-cols-2 gap-2">
        <Stat
          icon={Satellite01Icon}
          label={t.cell.coverage}
          value={`${Math.round(cell.coveredShare * 100)}%`}
        />
        <Stat
          icon={UserGroupIcon}
          label={t.stats.people}
          value={
            cell.people === null ? "—" : formatNumber(locale, Math.round(cell.people / areaKm2))
          }
        />
      </div>

      {nearestLead ? (
        <button
          type="button"
          onClick={() => onSelectBowl(nearestLead.bowl.id)}
          className="flex pressable items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2 text-left transition-colors duration-160 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
        >
          <HugeiconsIcon
            icon={Target01Icon}
            strokeWidth={2}
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="min-w-0 flex-1 truncate">{nearestLead.bowl.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {fill(t.cell.distance, { km: nearestLead.distanceKm.toFixed(1) })}
          </span>
        </button>
      ) : null}

      <Button size="sm" variant="outline" disabled={isFlagging} onClick={flag}>
        {t.cell.flag}
      </Button>
    </Panel>
  );
}
