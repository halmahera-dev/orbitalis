"use client";

import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@repo/ui/components/empty";
import { MoreHorizontalCircle01Icon, UserMultipleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createColumnHelper, useTable } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import type { TeamMember } from "@/features/team/team-queries";

import {
  DataTable,
  dataTableFeatures,
  initialPagination,
  type ColumnLayout,
  type DataTableFeatures,
  type DataTableLabels,
} from "@/components/data-table";
import {
  EditInspectorDialog,
  type TeamDialogLabels,
} from "@/features/team/components/team-dialogs";
import { InspectorFace } from "@/features/team/components/inspector-avatar";
import { archiveInspector, restoreInspector } from "@/features/team/team-actions";
import { fill, formatDateShort, type Dictionary, type Locale } from "@/lib/i18n";

const column = createColumnHelper<DataTableFeatures, TeamMember>();

const columnLayout: Record<string, ColumnLayout> = {
  note: { hideBelow: "md", wrap: true },
  openVisits: { alignEnd: true },
  nextVisitDate: { hideBelow: "sm" },
};

type TeamTableLabels = DataTableLabels & {
  team: Dictionary["team"];
  dialogs: TeamDialogLabels;
  locale: Locale;
};

function RowActions({
  member,
  labels,
  onEdit,
}: {
  member: TeamMember;
  labels: TeamTableLabels;
  onEdit: (member: TeamMember) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const t = labels.team;

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-xs" aria-label={t.actions} />}
      >
        <HugeiconsIcon icon={MoreHorizontalCircle01Icon} strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(member)}>{t.edit}</DropdownMenuItem>
        {member.active ? (
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => run(() => archiveInspector({ id: member.id }))}
          >
            {t.archive}
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={isPending}
            onClick={() => run(() => restoreInspector({ id: member.id }))}
          >
            {t.restore}
          </DropdownMenuItem>
        )}
        {member.openVisits > 0 ? (
          <DropdownMenuItem
            render={
              <Link href={`/${labels.locale}/bowls?assignee=${encodeURIComponent(member.name)}`} />
            }
          >
            {t.viewVisits}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TeamTable({
  members,
  isFiltered,
  labels,
}: {
  members: TeamMember[];
  isFiltered: boolean;
  labels: TeamTableLabels;
}) {
  const t = labels.team;
  const [editing, setEditing] = useState<TeamMember | null>(null);

  const columns = useMemo(
    () =>
      column.columns([
        column.accessor("name", {
          id: "name",
          header: t.name,
          sortFn: "alphanumeric",
          cell: ({ row }) => (
            <span className="inline-flex items-center gap-2.5">
              <InspectorFace name={row.original.name} size="sm" />
              <span className="font-medium">{row.original.name}</span>
            </span>
          ),
        }),
        column.accessor("active", {
          id: "status",
          header: t.status,
          sortFn: "basic",
          cell: ({ row }) => (
            <Badge variant={row.original.active ? "brand" : "secondary"}>
              {row.original.active ? t.statuses.active : t.statuses.archived}
            </Badge>
          ),
        }),
        column.accessor("openVisits", {
          id: "openVisits",
          header: t.openVisits,
          sortFn: "basic",
          cell: ({ row }) => (
            <span className="inline-flex items-center justify-end gap-2 tabular-nums">
              {row.original.openVisits}
              {row.original.overdueVisits > 0 ? (
                <Badge variant="destructive">
                  {fill(t.overdueCount, { count: row.original.overdueVisits })}
                </Badge>
              ) : null}
            </span>
          ),
        }),
        column.accessor("nextVisitDate", {
          id: "nextVisitDate",
          header: t.nextVisit,
          sortFn: "alphanumeric",
          cell: ({ row }) =>
            row.original.nextVisitDate
              ? formatDateShort(labels.locale, row.original.nextVisitDate)
              : "–",
        }),
        column.accessor("note", {
          id: "note",
          header: t.note,
          enableSorting: false,
          cell: ({ row }) => (
            <span className="text-muted-foreground">{row.original.note || "–"}</span>
          ),
        }),
        column.display({
          id: "actions",
          header: t.actions,
          cell: ({ row }) => (
            <RowActions member={row.original} labels={labels} onEdit={setEditing} />
          ),
        }),
      ]),
    [t, labels],
  );

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data: members,
    initialState: { pagination: initialPagination },
  });

  return (
    <>
      <DataTable
        table={table}
        columnLayout={columnLayout}
        labels={labels}
        empty={
          <Empty className="flex-none">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={UserMultipleIcon} />
              </EmptyMedia>
              <EmptyTitle>{isFiltered ? t.emptyFilteredTitle : t.empty}</EmptyTitle>
              {isFiltered ? <EmptyDescription>{t.emptyFilteredBody}</EmptyDescription> : null}
            </EmptyHeader>
          </Empty>
        }
        footer={members.length === 1 ? t.inViewOne : fill(t.inViewMany, { count: members.length })}
      />
      <EditInspectorDialog
        member={editing}
        labels={labels.dialogs}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null);
          }
        }}
      />
    </>
  );
}
