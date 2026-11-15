"use client";

import { Download01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/tooltip";
import { useState } from "react";

import type { Cell } from "@/features/bowls/bowls-queries";

import {
  planScore,
  unservedPeople,
  type PlanEntry,
  type PlanKind,
} from "@/features/plans/plan-scores";
import { fill, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const rankLimit = 40;

function Bar({ share }: { share: number }) {
  return (
    <span className="relative h-1.5 min-w-12 flex-1 rounded-full bg-muted-foreground/15">
      <span
        className="absolute inset-y-0 left-0 w-(--share) rounded-full bg-brand"
        style={{ "--share": `${Math.round(share * 100)}%` } as React.CSSProperties}
      />
    </span>
  );
}

export function CellRankPanel({
  locale,
  kind,
  cells,
  entries,
  onSelect,
  labels,
}: {
  locale: Locale;
  kind: PlanKind;
  cells: Cell[];
  entries: PlanEntry[];
  onSelect: (cellId: string) => void;
  labels: { map: Dictionary["map"] };
}) {
  const t = labels.map;
  const [tab, setTab] = useState<"ranked" | "plan">("ranked");
  const planned = entries.filter((entry) => entry.kind === kind);
  const statusByCell = new Map(planned.map((entry) => [entry.cellId, entry.status]));
  const ranked = cells
    .map((cell) => ({ cell, score: planScore(cell, kind) }))
    .filter((item) => item.score > 0)
    .toSorted((a, b) => b.score - a.score);
  const shown =
    tab === "ranked"
      ? ranked.slice(0, rankLimit)
      : ranked.filter((item) => statusByCell.has(item.cell.id));
  const topScore = ranked[0]?.score ?? 1;

  function valueOf(cell: Cell) {
    if (kind === "recharge") {
      return `${Math.round(cell.sinkingMmYr ?? 0)}`;
    }
    return formatNumber(locale, unservedPeople(cell) ?? 0);
  }

  return (
    <nav
      aria-label={t.plan.title[kind]}
      className="absolute top-4 right-4 hidden max-h-128 w-80 fade-in flex-col gap-2 overflow-hidden rounded-3xl border border-transparent glass p-2 shadow-md md:flex"
    >
      <div className="flex items-center gap-1" role="tablist">
        {(["ranked", "plan"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={cn(
              "flex-1 pressable rounded-full px-2 py-1.5 text-xs text-muted-foreground transition-colors duration-160 ease-out outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40",
              tab === option && "bg-muted text-foreground",
            )}
          >
            {option === "ranked"
              ? t.plan.title[kind]
              : fill(t.plan.inPlan, { count: planned.length })}
          </button>
        ))}
        {tab === "plan" ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t.plan.export}
                  nativeButton={false}
                  render={<a href={`/api/plans?kind=${kind}`} download />}
                />
              }
            >
              <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
            </TooltipTrigger>
            <TooltipContent>{t.plan.export}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      <div className="flex justify-between px-2 text-xs text-muted-foreground">
        <span>{t.plan.basis[kind]}</span>
        <span>{kind === "recharge" ? t.unitRate : t.plan.withoutPipes}</span>
      </div>
      {shown.length === 0 ? (
        <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t.triage.empty}</p>
      ) : (
        <ol className="flex flex-col overflow-y-auto">
          {shown.map((item, index) => (
            <li key={item.cell.id}>
              <button
                type="button"
                onClick={() => onSelect(item.cell.id)}
                className="flex w-full pressable items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-sm transition-colors duration-160 ease-out outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <span className="w-20 shrink-0 truncate tabular-nums">{item.cell.id}</span>
                <Bar share={item.score / topScore} />
                <span className="w-14 shrink-0 text-right text-muted-foreground tabular-nums">
                  {valueOf(item.cell)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </nav>
  );
}
