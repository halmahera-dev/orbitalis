"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { useEffect, useEffectEvent } from "react";

import type { RankedArea, PriorityLayer } from "@/features/areas/areas-priority";
import type { AreaEvidence } from "@/features/areas/areas-queries";

import { fill, formatNumber, type Dictionary, type Locale } from "@/lib/i18n";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

export function AreaPanel({
  locale,
  layer,
  rankedArea,
  cellSizeM,
  evidence,
  isSynthetic,
  labels,
  onClose,
}: {
  locale: Locale;
  layer: PriorityLayer;
  rankedArea: RankedArea;
  cellSizeM: number;
  evidence: AreaEvidence;
  isSynthetic: boolean;
  labels: { map: Dictionary["map"]; common: Dictionary["common"] };
  onClose: () => void;
}) {
  const t = labels.map.priority;
  const { area, score, rank } = rankedArea;
  const close = useEffectEvent(onClose);
  const number = (value: number) => formatNumber(locale, value);

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
      aria-label={fill(t.areaLabel, { kecamatan: area.kecamatan, id: area.id })}
      className="absolute right-4 bottom-4 left-4 flex max-h-80 fade-in flex-col gap-3 overflow-y-auto rounded-4xl border border-transparent glass p-4 text-sm shadow-md md:top-4 md:bottom-auto md:left-auto md:max-h-112 md:w-80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate type-title">{area.kecamatan}</h2>
          <p className="text-xs text-muted-foreground">
            {fill(t.areaTitle, { id: area.id })}
            {rank !== null && `, ${fill(labels.map.rankLabel, { rank })}`}
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={labels.common.close} onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </div>

      <dl className="flex flex-col divide-y">
        <Row label={t.score} value={fill(t.scoreValue, { score })} />
        <Row label={t.sinking} value={fill(t.sinkingValue, { value: area.sinkingMmYr })} />
        <Row
          label={t.population}
          value={fill(t.populationValue, { value: number(area.populationPerKm2) })}
        />
        <Row label={t.people} value={number(area.people)} />
        <Row label={t.unserved} value={number(area.unservedPeople)} />
        <Row
          label={t.piped}
          value={fill(t.percentValue, { value: Math.round(area.pipedShare * 100) })}
        />
        <Row label={t.economy} value={t.economyLevel[area.economy]} />
      </dl>

      <p className="text-muted-foreground">{t.layerNote[layer]}</p>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer text-sm text-foreground">
          {labels.map.evidenceTitle}
        </summary>
        <div className="flex flex-col gap-2 pt-2">
          {isSynthetic && <p>{labels.map.evidenceExample}</p>}
          <p>
            {fill(t.evidenceSource, {
              script: evidence.script,
              size: cellSizeM,
              period: evidence.period,
            })}
          </p>
          <p>{t.evidenceMethod}</p>
        </div>
      </details>
    </section>
  );
}
