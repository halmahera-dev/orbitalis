"use client";

import { Badge } from "@repo/ui/components/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { cn } from "@repo/ui/lib/utils";
import { ArrowRight02Icon, ListViewIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

import type { Bowl } from "@/features/bowls/bowls-queries";
import type { TeamMember } from "@/features/team/team-queries";

import {
  DataTable,
  dataTableFeatures,
  initialPagination,
  type ColumnLayout,
  type DataTableFeatures,
  type DataTableLabels,
} from "@/components/data-table";
import { BowlRowActions, type BowlActionLabels } from "@/features/bowls/components/bowl-actions";
import { calendarDate, isVisitOverdue } from "@/features/bowls/visit";
import {
  InspectorAvatar,
  type InspectorAvatarLabels,
} from "@/features/team/components/inspector-avatar";
import { Sparkline } from "@/features/today/components/today-charts";
import { fill, formatDateShort, type Dictionary, type Locale } from "@/lib/i18n";

const column = createColumnHelper<DataTableFeatures, Bowl>();

const columnLayout: Record<string, ColumnLayout> = {
  bowl: { wrap: true },
  kecamatan: { hideBelow: "sm" },
  assignee: { hideBelow: "sm" },
  visitDate: { hideBelow: "sm" },
  trend: { hideBelow: "lg" },
  depth: { hideBelow: "lg", alignEnd: true },
  change: { hideBelow: "lg", alignEnd: true },
  rate: { alignEnd: true },
};

const statusOrder: Bowl["status"][] = ["lead", "scheduled", "inspected", "closed", "dismissed"];

function changeAfterBan(bowl: Bowl) {
  return Math.round((bowl.rateAfterBanMmYr / bowl.rateBeforeBanMmYr - 1) * 100);
}

function RankCell({ bowl }: { bowl: Bowl }) {
  const previous = bowl.previousRank;
  const movedUp = previous !== null && previous > bowl.rank;
  const movedDown = previous !== null && previous < bowl.rank;

  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums">
      {movedUp || movedDown ? (
        <>
          <span className="text-muted-foreground">{previous}</span>
          <HugeiconsIcon
            icon={ArrowRight02Icon}
            strokeWidth={2}
            className="size-3 text-muted-foreground"
            aria-hidden="true"
          />
        </>
      ) : null}
      <span className={cn("font-medium", movedUp && "text-brand-text")}>{bowl.rank}</span>
    </span>
  );
}

export type BowlTableLabels = DataTableLabels & {
  bowls: Dictionary["bowls"];
  actions: BowlActionLabels;
  inspector: InspectorAvatarLabels;
};

export function BowlTable({
  bowls,
  locale,
  isFiltered,
  nisarByBowlId,
  inspectors,
  membersByName,
  labels,
}: {
  bowls: Bowl[];
  locale: Locale;
  isFiltered: boolean;
  nisarByBowlId: Record<string, number[]>;
  inspectors: string[];
  membersByName: Record<string, TeamMember>;
  labels: BowlTableLabels;
}) {
  const router = useRouter();
  const t = labels.bowls;
  const today = calendarDate();

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor("rank", {
          header: t.rank,
          sortFn: "basic",
          cell: ({ row }) => <RankCell bowl={row.original} />,
        }),
        column.accessor("name", {
          id: "bowl",
          header: t.bowl,
          sortFn: "alphanumeric",
          cell: ({ row }) => (
            <>
              <Link
                href={`/${locale}/bowls/${row.original.id}`}
                className="font-medium transition-colors duration-160 ease-out hover:text-brand-text focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                {row.original.name}
              </Link>
              <p className="text-xs text-muted-foreground sm:hidden">{row.original.kecamatan}</p>
            </>
          ),
        }),
        column.accessor("kecamatan", { header: t.kecamatan, sortFn: "alphanumeric" }),
        column.accessor((bowl) => statusOrder.indexOf(bowl.status), {
          id: "status",
          header: t.status,
          sortFn: "basic",
          cell: ({ row }) => (
            <Badge variant={row.original.status === "lead" ? "brand" : "secondary"}>
              {t.statuses[row.original.status]}
            </Badge>
          ),
        }),
        column.accessor("assignee", {
          header: t.assignee,
          sortFn: "alphanumeric",
          cell: ({ row }) => {
            const name = row.original.assignee;
            if (!name) {
              return null;
            }
            return (
              <InspectorAvatar
                name={name}
                member={membersByName[name] ?? null}
                locale={locale}
                labels={labels.inspector}
                size="sm"
              />
            );
          },
        }),
        column.accessor("visitDate", {
          header: t.visitDate,
          sortFn: "alphanumeric",
          cell: ({ row }) => {
            const bowl = row.original;
            if (!bowl.visitDate) {
              return null;
            }
            return (
              <span className="inline-flex flex-col gap-0.5 font-mono text-xs">
                <span>{formatDateShort(locale, bowl.visitDate)}</span>
                {isVisitOverdue(bowl, today) ? (
                  <span className="font-sans text-destructive">{t.overdue}</span>
                ) : null}
              </span>
            );
          },
        }),
        column.accessor("rateAfterBanMmYr", { id: "rate", header: t.rate, sortFn: "basic" }),
        column.display({
          id: "trend",
          header: t.trend,
          cell: ({ row }) => {
            const values = nisarByBowlId[row.original.id] ?? [];
            if (values.length < 2) {
              return null;
            }
            return (
              <div className="w-24">
                <Sparkline values={values} color="var(--brand)" className="h-8" />
              </div>
            );
          },
        }),
        column.accessor("depthCm", {
          id: "depth",
          header: t.depth,
          sortFn: "basic",
          cell: ({ row }) => `${row.original.depthCm} cm`,
        }),
        column.accessor(changeAfterBan, {
          id: "change",
          header: t.afterBan,
          sortFn: "basic",
          cell: ({ row }) => `${changeAfterBan(row.original)}%`,
        }),
        column.display({
          id: "actions",
          header: t.actions,
          cell: ({ row }) => {
            const [lng, lat] = row.original.center;
            return (
              <BowlRowActions
                bowl={{ id: row.original.id, name: row.original.name }}
                status={row.original.status}
                mapHref={`/${locale}/map?at=${lng.toFixed(4)},${lat.toFixed(4)},13`}
                labels={labels.actions}
                inspectors={inspectors}
              />
            );
          },
        }),
      ]),
    [t, locale, nisarByBowlId, labels.actions, labels.inspector, inspectors, membersByName, today],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: bowls,
    initialState: { pagination: initialPagination },
  });

  return (
    <DataTable
      table={table}
      columnLayout={columnLayout}
      labels={labels}
      onRowClick={(bowl) => router.push(`/${locale}/bowls/${bowl.id}`)}
      empty={
        <Empty className="flex-none">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={ListViewIcon} />
            </EmptyMedia>
            <EmptyTitle>{isFiltered ? t.emptyFilteredTitle : t.empty}</EmptyTitle>
            {isFiltered ? <EmptyDescription>{t.emptyFilteredBody}</EmptyDescription> : null}
          </EmptyHeader>
        </Empty>
      }
      footer={bowls.length === 1 ? t.inViewOne : fill(t.inViewMany, { count: bowls.length })}
    />
  );
}
