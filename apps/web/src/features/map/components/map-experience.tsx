import { getBowls, getCells, getLatestRun } from "@/features/bowls/bowls-queries";
import { OrbitalisMap } from "@/features/map/components/orbitalis-map";
import { getPlanEntries } from "@/features/plans/plans-queries";
import { getActiveInspectorNames } from "@/features/team/team-queries";
import { requireSession } from "@/features/user/user-queries";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function MapExperience({ locale }: { locale: Locale }) {
  await requireSession(locale);
  const t = getDictionary(locale);
  const [bowls, cells, run, planEntries, inspectors] = await Promise.all([
    getBowls(),
    getCells(),
    getLatestRun(),
    getPlanEntries(),
    getActiveInspectorNames(),
  ]);
  return (
    <OrbitalisMap
      locale={locale}
      bowls={bowls}
      cells={cells}
      cellSizeM={run?.cellSizeM ?? 480}
      planEntries={planEntries}
      inspectors={inspectors}
      labels={{
        map: t.map,
        common: t.common,
        statuses: t.bowls.statuses,
        actions: {
          dialogs: t.bowls.dialogs,
          outcomes: t.bowls.outcomes,
          cancel: t.common.cancel,
          save: t.common.save,
          scheduleVisit: t.bowls.scheduleVisit,
          dismiss: t.bowls.dismiss,
          restore: t.bowls.restore,
          recordOutcome: t.bowls.recordOutcome,
          actions: t.bowls.actions,
        },
      }}
    />
  );
}
