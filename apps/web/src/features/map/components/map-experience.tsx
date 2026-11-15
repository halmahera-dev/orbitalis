import { getPriorityAreas } from "@/features/areas/areas-queries";
import { getNisarLeads, getPublicBowls } from "@/features/bowls/bowls-queries";
import { OrbitalisMap } from "@/features/map/components/orbitalis-map";
import { nisarStack } from "@/features/nisar/nisar-queries";
import { getActiveInspectorNames } from "@/features/team/team-queries";
import { requireSession } from "@/features/user/user-queries";
import { getDictionary, type Locale } from "@/lib/i18n";

export async function MapExperience({ locale }: { locale: Locale }) {
  await requireSession(locale);
  const t = getDictionary(locale);
  const [nisarLeads, inspectors] = await Promise.all([getNisarLeads(), getActiveInspectorNames()]);
  return (
    <OrbitalisMap
      locale={locale}
      bowls={getPublicBowls()}
      areaSet={getPriorityAreas()}
      nisarLeads={nisarLeads}
      candidateEvidence={{
        pairCount: nisarStack.tracks.reduce((total, track) => total + track.pairCount, 0),
        ascendingPairCount: nisarStack.tracks[0].pairCount,
        noiseFloorMmYr: nisarStack.noiseFloorMmYr,
        detectionSnr: nisarStack.detectionSnr,
      }}
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
