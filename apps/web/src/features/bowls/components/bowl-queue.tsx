import { Skeleton } from "@repo/ui/components/skeleton";

import { KpiCards } from "@/components/kpi-cards";
import { getBowlSeriesById, getBowls } from "@/features/bowls/bowls-queries";
import { anyValue, BowlFilters, overdueValue } from "@/features/bowls/components/bowl-filters";
import { BowlTable } from "@/features/bowls/components/bowl-table";
import { calendarDate, isVisitOverdue } from "@/features/bowls/visit";
import { getTeamMembers } from "@/features/team/team-queries";
import { getDictionary, type Locale } from "@/lib/i18n";

export type BowlQueueFilters = {
  search: string;
  kecamatan: string | null;
  status: string | null;
  assignee: string | null;
  overdue: boolean;
};

export async function BowlQueue({
  locale,
  filters,
}: {
  locale: Locale;
  filters: BowlQueueFilters;
}) {
  const dictionary = getDictionary(locale);
  const t = dictionary.bowls;
  const { search, kecamatan, status, assignee, overdue } = filters;
  const [allBowls, members] = await Promise.all([getBowls(), getTeamMembers()]);
  const inspectors = members.filter((member) => member.active).map((member) => member.name);
  const membersByName = Object.fromEntries(members.map((member) => [member.name, member]));
  const searchText = search.toLowerCase();
  const today = calendarDate();
  const bowls = allBowls
    .filter((bowl) => (status ? bowl.status === status : bowl.status !== "dismissed"))
    .filter((bowl) => !kecamatan || bowl.kecamatan === kecamatan)
    .filter((bowl) => !assignee || bowl.assignee === assignee)
    .filter((bowl) => !overdue || isVisitOverdue(bowl, today))
    .filter(
      (bowl) =>
        !searchText ||
        bowl.name.toLowerCase().includes(searchText) ||
        bowl.kecamatan.toLowerCase().includes(searchText) ||
        (bowl.assignee?.toLowerCase().includes(searchText) ?? false),
    )
    .toSorted((a, b) => a.rank - b.rank);
  const kecamatanNames = [...new Set(allBowls.map((bowl) => bowl.kecamatan))].toSorted();
  const assigneeNames = [
    ...new Set([
      ...inspectors,
      ...allBowls.flatMap((bowl) => (bowl.assignee ? [bowl.assignee] : [])),
    ]),
  ].toSorted();
  const fastestRate = Math.max(0, ...bowls.map((bowl) => bowl.rateAfterBanMmYr));
  const nisarByBowlId = Object.fromEntries(
    Object.entries(getBowlSeriesById()).map(([id, series]) => [
      id,
      series.nisar.map((point) => point.mm),
    ]),
  );
  const actionLabels = {
    dialogs: t.dialogs,
    outcomes: t.outcomes,
    cancel: dictionary.common.cancel,
    save: dictionary.common.save,
    scheduleVisit: t.scheduleVisit,
    dismiss: t.dismiss,
    restore: t.restore,
    recordOutcome: t.recordOutcome,
    actions: t.actions,
    viewOnMap: t.viewOnMap,
  };

  return (
    <>
      <KpiCards
        items={[
          { label: t.kpiInView, value: bowls.length },
          { label: t.kpiLeads, value: bowls.filter((bowl) => bowl.status === "lead").length },
          {
            label: t.kpiScheduled,
            value: bowls.filter((bowl) => bowl.status === "scheduled").length,
          },
          {
            label: t.kpiOverdue,
            value: bowls.filter((bowl) => isVisitOverdue(bowl, today)).length,
          },
          { label: t.kpiFastest, value: fastestRate },
        ]}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <BowlFilters
          search={search}
          kecamatan={kecamatan}
          status={status}
          assignee={assignee}
          overdue={overdue}
          kecamatanOptions={[
            { value: anyValue, label: t.allKecamatan },
            ...kecamatanNames.map((name) => ({ value: name, label: name })),
          ]}
          statusOptions={[
            { value: anyValue, label: t.allStatuses },
            ...Object.entries(t.statuses).map(([value, label]) => ({ value, label })),
          ]}
          assigneeOptions={[
            { value: anyValue, label: t.allInspectors },
            ...assigneeNames.map((name) => ({ value: name, label: name })),
          ]}
          overdueOptions={[
            { value: anyValue, label: t.allVisitDates },
            { value: overdueValue, label: t.overdue },
          ]}
          labels={{
            search: dictionary.common.search,
            searchPlaceholder: t.searchPlaceholder,
            kecamatan: t.kecamatan,
            status: t.status,
            assignee: t.assignee,
            overdue: t.overdue,
            clear: dictionary.common.clear,
            loading: dictionary.common.loading,
          }}
        />
      </div>
      <BowlTable
        bowls={bowls}
        locale={locale}
        isFiltered={Boolean(search || kecamatan || status || assignee || overdue)}
        nisarByBowlId={nisarByBowlId}
        inspectors={inspectors}
        membersByName={membersByName}
        labels={{
          bowls: t,
          pageOf: dictionary.common.pageOf,
          previous: dictionary.common.previous,
          next: dictionary.common.next,
          actions: actionLabels,
          inspector: {
            openVisits: dictionary.team.openVisits,
            nextVisit: dictionary.team.nextVisit,
            note: dictionary.team.note,
            overdueCount: dictionary.team.overdueCount,
            statuses: dictionary.team.statuses,
          },
        }}
      />
    </>
  );
}

export function BowlQueueSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-18" />
        ))}
      </div>
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-64" />
    </div>
  );
}
