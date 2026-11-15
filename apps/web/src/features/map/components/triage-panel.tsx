"use client";

import {
  DashboardSpeed01Icon,
  Flag01Icon,
  SignalFull02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { ToggleGroup, ToggleGroupItem } from "@repo/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { useRef, type KeyboardEvent } from "react";

import type { Bowl, BowlStatus } from "@/features/bowls/bowls-queries";

import { RateRange } from "@/features/bowls/components/rate-range";
import { statusDotColors } from "@/features/bowls/visit";
import { triageSorts, type TriageSort } from "@/features/map/map-layers";
import { fill, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const triageStatuses = ["lead", "scheduled", "closed", "dismissed"] as const;

export type TriageStatus = (typeof triageStatuses)[number];

const sortIcons = {
  signal: SignalFull02Icon,
  rate: DashboardSpeed01Icon,
  people: UserGroupIcon,
} as const;

function inTriageStatus(status: BowlStatus, triageStatus: TriageStatus) {
  if (triageStatus === "closed") {
    return status === "closed" || status === "inspected";
  }
  return status === triageStatus;
}

function sortValue(bowl: Bowl, sort: TriageSort) {
  switch (sort) {
    case "signal":
      return bowl.snr ?? -Infinity;
    case "rate":
      return bowl.rateMmYr ?? -Infinity;
    case "people":
      return bowl.peoplePerKm2 ?? -Infinity;
  }
}

function sortLabel(bowl: Bowl, sort: TriageSort, locale: Locale) {
  switch (sort) {
    case "signal":
      return bowl.snr === null ? "—" : `×${bowl.snr}`;
    case "rate":
      return bowl.rateMmYr === null ? "—" : String(Math.round(bowl.rateMmYr));
    case "people":
      return bowl.peoplePerKm2 === null
        ? "—"
        : formatNumber(locale, Math.round(bowl.peoplePerKm2 / 100) * 100);
  }
}

export function TriagePanel({
  locale,
  bowls,
  status,
  sort,
  selectedId,
  onStatusChange,
  onSortChange,
  onSelect,
  sorts = triageSorts,
  labels,
}: {
  locale: Locale;
  bowls: Bowl[];
  status: TriageStatus;
  sort: TriageSort;
  selectedId: string | null;
  onStatusChange: (status: TriageStatus) => void;
  onSortChange: (sort: TriageSort) => void;
  onSelect: (bowlId: string) => void;
  sorts?: readonly TriageSort[];
  labels: { map: Dictionary["map"]; statuses: Dictionary["bowls"]["statuses"] };
}) {
  const t = labels.map;
  const listRef = useRef<HTMLOListElement>(null);
  const activeSort = sorts.includes(sort) ? sort : sorts[0];
  const shown = bowls
    .filter((bowl) => inTriageStatus(bowl.status, status))
    .toSorted((a, b) => sortValue(b, activeSort) - sortValue(a, activeSort));
  const maxRate = Math.max(
    1,
    ...shown.map((bowl) => (bowl.rateMmYr ?? 0) + (bowl.uncertaintyMmYr ?? 0)),
  );

  function moveFocus(event: KeyboardEvent<HTMLOListElement>) {
    const step = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const rows = [...(listRef.current?.querySelectorAll("button") ?? [])];
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    rows[Math.min(Math.max(current + step, 0), rows.length - 1)]?.focus();
  }

  return (
    <nav
      aria-label={t.triage.title}
      className="absolute top-4 right-4 hidden max-h-128 w-80 fade-in flex-col gap-2 overflow-hidden rounded-3xl border border-transparent glass p-2 shadow-md md:flex"
    >
      <div className="flex items-center gap-1" role="tablist" aria-label={t.triage.title}>
        {triageStatuses.map((option) => {
          const count = bowls.filter((bowl) => inTriageStatus(bowl.status, option)).length;
          const isActive = option === status;
          return (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onStatusChange(option)}
              className={cn(
                "flex flex-1 pressable items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-160 ease-out outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40",
                isActive && "bg-muted text-foreground",
              )}
            >
              <span
                className={cn("size-2 shrink-0 rounded-full", statusDotColors[option])}
                aria-hidden="true"
              />
              <span className="truncate">{labels.statuses[option]}</span>
              <span className="tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 px-2">
        <span className="text-xs text-muted-foreground">{t.unitRate}</span>
        <ToggleGroup
          aria-label={t.triage.sort}
          size="sm"
          spacing={1}
          value={[activeSort]}
          onValueChange={(next) => next[0] && onSortChange(next[0] as TriageSort)}
        >
          {sorts.map((option) => (
            <Tooltip key={option}>
              <TooltipTrigger
                render={<ToggleGroupItem value={option} aria-label={t.triage.sortBy[option]} />}
              >
                <HugeiconsIcon icon={sortIcons[option]} strokeWidth={2} />
              </TooltipTrigger>
              <TooltipContent>{t.triage.sortBy[option]}</TooltipContent>
            </Tooltip>
          ))}
        </ToggleGroup>
      </div>

      {shown.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t.triage.empty}</p>
      ) : (
        <ol ref={listRef} className="flex flex-col overflow-y-auto" onKeyDown={moveFocus}>
          {shown.map((bowl, index) => (
            <li key={bowl.id}>
              <button
                type="button"
                aria-current={bowl.id === selectedId}
                aria-label={`${bowl.name}, ${fill(t.rankLabel, { rank: index + 1 })}`}
                onClick={() => onSelect(bowl.id)}
                className={cn(
                  "flex w-full pressable items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-sm transition-colors duration-160 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40",
                  bowl.id === selectedId && "bg-brand/12 hover:bg-brand/12",
                )}
              >
                <span className="w-4 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="flex w-24 min-w-0 shrink-0 items-center gap-1">
                  <span className="truncate">{bowl.name}</span>
                  {bowl.source === "manual" ? (
                    <HugeiconsIcon
                      icon={Flag01Icon}
                      strokeWidth={2}
                      className="size-3.5 shrink-0 text-muted-foreground"
                      aria-label={t.legend.manual}
                    />
                  ) : null}
                  {bowl.isOneTrack ? (
                    <span className="shrink-0 text-xs text-muted-foreground">1×</span>
                  ) : null}
                </span>
                {bowl.rateMmYr !== null ? (
                  <RateRange
                    rateMmYr={bowl.rateMmYr}
                    uncertaintyMmYr={bowl.uncertaintyMmYr}
                    maxMmYr={maxRate}
                    label={fill(t.rateValue, {
                      rate: Math.round(bowl.rateMmYr),
                      uncertainty: Math.round(bowl.uncertaintyMmYr ?? 0),
                    })}
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <span className="w-12 shrink-0 text-right text-muted-foreground tabular-nums">
                  {sortLabel(bowl, activeSort, locale)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
