import type { NisarLead } from "@/features/bowls/bowls-queries";

import { candidateLabel } from "@/features/areas/areas-priority";
import { BowlRowActions, type BowlActionLabels } from "@/features/bowls/components/bowl-actions";
import { isVisitOverdue } from "@/features/bowls/visit";
import { fill, formatDateShort, type Dictionary, type Locale } from "@/lib/i18n";

function candidateMapHref(locale: Locale, lead: NisarLead) {
  const [longitude, latitude] = lead.center;
  return `/${locale}/map?lead=${lead.id}&at=${longitude.toFixed(4)},${latitude.toFixed(4)},14.00`;
}

export function NisarLeads({
  locale,
  leads,
  today,
  inspectors,
  labels,
}: {
  locale: Locale;
  leads: NisarLead[];
  today: string;
  inspectors: string[];
  labels: {
    map: Dictionary["map"];
    bowls: Dictionary["bowls"];
    actions: BowlActionLabels & { viewOnMap: string };
  };
}) {
  const t = labels.map;
  const b = labels.bowls;

  if (leads.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="nisar-leads"
      className="flex flex-col gap-2 border-b px-4 py-4 sm:px-6"
    >
      <h2 id="nisar-leads" className="text-sm font-medium">
        {t.foundInNisar}
      </h2>
      <ul className="flex flex-col divide-y">
        {leads.map((lead) => (
          <li key={lead.id} className="flex flex-wrap items-center gap-x-6 gap-y-1 py-2 text-sm">
            <span className="flex min-w-48 flex-1 flex-col">
              <span>{fill(t.nearBowl, { name: lead.name })}</span>
              <span className="text-xs text-muted-foreground">
                {candidateLabel(lead.basis) === "oneTrack" ? t.oneTrackOnly : lead.kecamatan}
              </span>
            </span>
            <span className="w-36 text-right tabular-nums">
              {fill(t.rateValue, { rate: lead.rateMmYr, uncertainty: lead.uncertaintyMmYr })}
            </span>
            <span className="w-24">{b.statuses[lead.status]}</span>
            <span className="w-32 text-muted-foreground">{lead.assignee ?? "—"}</span>
            <span className="w-28 text-xs tabular-nums">
              {lead.visitDate ? formatDateShort(locale, lead.visitDate) : "—"}
              {isVisitOverdue(lead, today) ? (
                <span className="block text-destructive">{b.overdue}</span>
              ) : null}
            </span>
            <BowlRowActions
              bowl={{ id: lead.id, name: fill(t.nearBowl, { name: lead.name }) }}
              status={lead.status}
              mapHref={candidateMapHref(locale, lead)}
              labels={labels.actions}
              inspectors={inspectors}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
