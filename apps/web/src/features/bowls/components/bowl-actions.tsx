"use client";

import { Button } from "@repo/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@repo/ui/components/dropdown-menu";
import { MoreHorizontalCircle01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { BowlStatus } from "@/features/bowls/bowls-queries";

import { moveBowl } from "@/features/bowls/bowls-actions";
import {
  OutcomeDialog,
  ScheduleVisitDialog,
  type VisitDialogLabels,
} from "@/features/bowls/components/visit-dialogs";
import { visitActionsForStatus, type BowlVisitAction } from "@/features/bowls/visit";

export type BowlActionLabels = VisitDialogLabels & {
  scheduleVisit: string;
  dismiss: string;
  restore: string;
  recordOutcome: string;
  actions: string;
  viewOnMap?: string;
};

function actionLabel(action: BowlVisitAction, labels: BowlActionLabels) {
  switch (action) {
    case "schedule":
      return labels.scheduleVisit;
    case "outcome":
      return labels.recordOutcome;
    case "dismiss":
      return labels.dismiss;
    case "restore":
      return labels.restore;
  }
}

function useBowlVisit(
  bowl: { id: string; name: string },
  labels: BowlActionLabels,
  inspectors: string[],
) {
  const [openDialog, setOpenDialog] = useState<"schedule" | "outcome" | null>(null);
  const [isMoving, startMoving] = useTransition();

  function move(nextStatus: "lead" | "dismissed") {
    startMoving(async () => {
      const result = await moveBowl({ bowlId: bowl.id, status: nextStatus });
      if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function closeDialog(open: boolean) {
    if (!open) {
      setOpenDialog(null);
    }
  }

  function run(action: BowlVisitAction) {
    if (action === "schedule") {
      setOpenDialog("schedule");
      return;
    }
    if (action === "outcome") {
      setOpenDialog("outcome");
      return;
    }
    move(action === "dismiss" ? "dismissed" : "lead");
  }

  const dialogs = (
    <>
      <ScheduleVisitDialog
        bowl={openDialog === "schedule" ? bowl : null}
        labels={labels}
        inspectors={inspectors}
        onOpenChange={closeDialog}
      />
      <OutcomeDialog
        bowl={openDialog === "outcome" ? bowl : null}
        labels={labels}
        onOpenChange={closeDialog}
      />
    </>
  );

  return { isMoving, run, dialogs };
}

export function BowlActions({
  bowl,
  status,
  labels,
  inspectors,
}: {
  bowl: { id: string; name: string };
  status: BowlStatus;
  labels: BowlActionLabels;
  inspectors: string[];
}) {
  const { isMoving, run, dialogs } = useBowlVisit(bowl, labels, inspectors);

  return (
    <div className="flex flex-wrap gap-2">
      {visitActionsForStatus(status).map((action) => (
        <Button
          key={action}
          size="sm"
          variant={action === "schedule" || action === "outcome" ? "default" : "outline"}
          disabled={isMoving && (action === "dismiss" || action === "restore")}
          onClick={() => run(action)}
        >
          {actionLabel(action, labels)}
        </Button>
      ))}
      {dialogs}
    </div>
  );
}

export function BowlRowActions({
  bowl,
  status,
  mapHref,
  labels,
  inspectors,
}: {
  bowl: { id: string; name: string };
  status: BowlStatus;
  mapHref: string;
  labels: BowlActionLabels;
  inspectors: string[];
}) {
  const { isMoving, run, dialogs } = useBowlVisit(bowl, labels, inspectors);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon-xs" aria-label={labels.actions} />}
        >
          <HugeiconsIcon icon={MoreHorizontalCircle01Icon} strokeWidth={2} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {visitActionsForStatus(status).map((action) => (
            <DropdownMenuItem
              key={action}
              disabled={isMoving && (action === "dismiss" || action === "restore")}
              onClick={() => run(action)}
            >
              {actionLabel(action, labels)}
            </DropdownMenuItem>
          ))}
          {labels.viewOnMap ? (
            <DropdownMenuItem render={<Link href={mapHref} />}>{labels.viewOnMap}</DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </div>
  );
}
