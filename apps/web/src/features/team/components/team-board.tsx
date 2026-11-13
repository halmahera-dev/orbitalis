import { Skeleton } from "@repo/ui/components/skeleton";

import { anyValue, TeamFilters } from "@/features/team/components/team-filters";
import { TeamTable } from "@/features/team/components/team-table";
import { getTeamInsights, getTeamMembers } from "@/features/team/team-queries";
import { Metric } from "@/features/today/components/today-panels";
import { fill, getDictionary, type Locale } from "@/lib/i18n";

export type TeamBoardFilters = {
  search: string;
  status: string | null;
};

export async function TeamBoard({
  locale,
  filters,
}: {
  locale: Locale;
  filters: TeamBoardFilters;
}) {
  const dictionary = getDictionary(locale);
  const t = dictionary.team;
  const { search, status } = filters;
  const [members, insights] = await Promise.all([getTeamMembers(), getTeamInsights()]);
  const searchText = search.toLowerCase();
  const visible = members
    .filter((member) => {
      if (status === "active") {
        return member.active;
      }
      if (status === "archived") {
        return !member.active;
      }
      return true;
    })
    .filter(
      (member) =>
        !searchText ||
        member.name.toLowerCase().includes(searchText) ||
        (member.note?.toLowerCase().includes(searchText) ?? false),
    )
    .toSorted((a, b) => {
      if (a.active !== b.active) {
        return a.active ? -1 : 1;
      }
      return b.openVisits - a.openVisits || a.name.localeCompare(b.name);
    });

  const dialogLabels = {
    dialogs: t.dialogs,
    cancel: dictionary.common.cancel,
    save: dictionary.common.save,
  };

  const insightLine = insights.heaviest
    ? fill(t.insightHeaviest, {
        name: insights.heaviest.name,
        count: insights.heaviest.openVisits,
      })
    : t.insightQuiet;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 border-b px-4 py-4 sm:px-6 lg:grid-cols-4">
        <Metric
          label={t.kpiActive}
          value={String(insights.activeCount)}
          href={`/${locale}/team?status=active`}
        />
        <Metric
          label={t.kpiWeek}
          value={String(insights.visitsThisWeek)}
          href={`/${locale}/bowls?status=scheduled`}
        />
        <Metric
          label={t.kpiOverdue}
          value={String(insights.overdueCount)}
          href={`/${locale}/bowls?overdue=1`}
        />
        <Metric
          label={t.kpiHeaviest}
          value={insights.heaviest ? insights.heaviest.name : t.kpiHeaviestEmpty}
          detail={
            insights.heaviest
              ? fill(t.kpiHeaviestDetail, { count: insights.heaviest.openVisits })
              : null
          }
          href={
            insights.heaviest
              ? `/${locale}/bowls?assignee=${encodeURIComponent(insights.heaviest.name)}`
              : undefined
          }
        />
      </div>
      <p className="border-b px-4 py-3 text-sm text-muted-foreground sm:px-6">{insightLine}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
        <TeamFilters
          search={search}
          status={status}
          statusOptions={[
            { value: anyValue, label: t.allStatuses },
            { value: "active", label: t.statuses.active },
            { value: "archived", label: t.statuses.archived },
          ]}
          labels={{
            search: dictionary.common.search,
            searchPlaceholder: t.searchPlaceholder,
            status: t.status,
            clear: dictionary.common.clear,
            loading: dictionary.common.loading,
          }}
        />
      </div>
      <TeamTable
        members={visible}
        isFiltered={Boolean(search || status)}
        labels={{
          team: t,
          dialogs: dialogLabels,
          locale,
          pageOf: dictionary.common.pageOf,
          previous: dictionary.common.previous,
          next: dictionary.common.next,
        }}
      />
    </>
  );
}

export function TeamBoardSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-22" />
        ))}
      </div>
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="h-8 w-96 max-w-full" />
      <Skeleton className="h-64" />
    </div>
  );
}
