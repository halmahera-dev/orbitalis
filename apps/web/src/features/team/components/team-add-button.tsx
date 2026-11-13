"use client";

import { Button } from "@repo/ui/components/button";
import { useState } from "react";

import { AddInspectorDialog, type TeamDialogLabels } from "@/features/team/components/team-dialogs";

export function TeamAddButton({ labels }: { labels: TeamDialogLabels & { add: string } }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {labels.add}
      </Button>
      <AddInspectorDialog open={open} labels={labels} onOpenChange={setOpen} />
    </>
  );
}
