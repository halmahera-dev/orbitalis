import { Skeleton } from "@repo/ui/components/skeleton";
import { notFound } from "next/navigation";

import type { Locale } from "@/lib/i18n";

import { getBowl, getBowls, getLatestRun } from "@/features/bowls/bowls-queries";
import { BowlActions } from "@/features/bowls/components/bowl-actions";
import { BowlTwinView } from "@/features/bowls/components/bowl-twin-view";
import { getActiveInspectorNames } from "@/features/team/team-queries";
import { requireSession } from "@/features/user/user-queries";
import { fill, formatDate, getDictionary } from "@/lib/i18n";

export async function BowlTwin({ locale, bowlId }: { locale: Locale; bowlId: string }) {
  await requireSession(locale);
  const dictionary = getDictionary(locale);
  const t = dictionary.bowls;
  const [bowl, bowls, run, inspectors] = await Promise.all([
    getBowl(bowlId),
    getBowls(),
    getLatestRun(),
    getActiveInspectorNames(),
  ]);
  if (!bowl) {
    notFound();
  }

  return (
    <BowlTwinView
      locale={locale}
      bowl={bowl}
      run={run}
      bowlOptions={bowls.map(({ id, name, rank }) => ({ id, name, rank }))}
      labels={{ map: dictionary.map, bowls: t, common: dictionary.common }}
      actions={
        <BowlActions
          bowl={{ id: bowl.id, name: bowl.name }}
          status={bowl.status}
          inspectors={inspectors}
          labels={{
            dialogs: t.dialogs,
            outcomes: t.outcomes,
            cancel: dictionary.common.cancel,
            save: dictionary.common.save,
            scheduleVisit: t.scheduleVisit,
            dismiss: t.dismiss,
            restore: t.restore,
            recordOutcome: t.recordOutcome,
            actions: t.actions,
          }}
        />
      }
      inspection={
        <div className="flex flex-col gap-3 text-sm">
          <p>{t.statuses[bowl.status]}</p>
          {bowl.assignee && bowl.visitDate ? (
            <p>
              {fill(t.assignedTo, {
                assignee: bowl.assignee,
                date: formatDate(locale, bowl.visitDate),
              })}
            </p>
          ) : null}
          {bowl.outcome ? (
            <p>
              {fill(t.outcomeIs, { outcome: t.outcomes[bowl.outcome] })} {bowl.note}
            </p>
          ) : null}
        </div>
      }
    />
  );
}

export function BowlTwinSkeleton() {
  return (
    <div className="flex h-svh flex-col bg-background">
      <div className="flex items-center gap-4 border-b px-4 py-3">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="flex-1" />
    </div>
  );
}
