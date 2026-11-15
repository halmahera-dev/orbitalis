"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@repo/ui/components/button";
import { useEffect, useEffectEvent, type ReactNode } from "react";

import type { NisarLead } from "@/features/bowls/bowls-queries";

import { candidateLabel } from "@/features/areas/areas-priority";
import { fill, type Dictionary } from "@/lib/i18n";

export type CandidateEvidence = {
  pairCount: number;
  ascendingPairCount: number;
  noiseFloorMmYr: number;
  detectionSnr: number;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums">{value}</dd>
    </div>
  );
}

export function CandidatePanel({
  lead,
  evidence,
  labels,
  actions,
  onClose,
}: {
  lead: NisarLead;
  evidence: CandidateEvidence;
  labels: {
    map: Dictionary["map"];
    common: Dictionary["common"];
    statuses: Dictionary["bowls"]["statuses"];
  };
  actions: ReactNode;
  onClose: () => void;
}) {
  const t = labels.map;
  const isOneTrack = candidateLabel(lead.basis) === "oneTrack";
  const pairCount = isOneTrack ? evidence.ascendingPairCount : evidence.pairCount;
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
      aria-label={fill(t.nearBowl, { name: lead.name })}
      className="absolute right-4 bottom-4 left-4 flex max-h-80 fade-in flex-col gap-3 overflow-y-auto rounded-4xl border border-transparent glass p-4 text-sm shadow-md md:top-4 md:bottom-auto md:left-auto md:max-h-112 md:w-80"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="truncate type-title">{fill(t.nearBowl, { name: lead.name })}</h2>
          <p className="text-xs text-muted-foreground">
            {lead.kecamatan}, {t.foundInNisar}
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label={labels.common.close} onClick={onClose}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </div>

      {isOneTrack && <p className="text-foreground">{t.oneTrackOnly}</p>}

      <dl className="flex flex-col divide-y">
        <Row
          label={isOneTrack ? t.candidateRateOneTrack : t.candidateRate}
          value={fill(t.rateValue, { rate: lead.rateMmYr, uncertainty: lead.uncertaintyMmYr })}
        />
        <Row label={t.candidateSize} value={fill(t.candidateSizeValue, { radius: lead.radiusM })} />
        <Row
          label={t.candidatePairs}
          value={fill(isOneTrack ? t.candidatePairsOneTrack : t.candidatePairsValue, {
            count: pairCount,
          })}
        />
        <Row label={t.candidateStatus} value={labels.statuses[lead.status]} />
      </dl>

      <p className="text-muted-foreground">{labels.common.leadLabel}</p>

      {actions}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer text-sm text-foreground">{t.evidenceTitle}</summary>
        <p className="pt-2">
          {fill(t.candidateEvidence, {
            count: pairCount,
            noise: evidence.noiseFloorMmYr,
            snr: evidence.detectionSnr,
          })}
        </p>
      </details>
    </section>
  );
}
