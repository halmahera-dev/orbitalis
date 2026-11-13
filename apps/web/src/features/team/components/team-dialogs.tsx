"use client";

import { Button } from "@repo/ui/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { Spinner } from "@repo/ui/components/spinner";
import { Textarea } from "@repo/ui/components/textarea";
import { useTransition } from "react";
import { toast } from "sonner";

import { createInspector, updateInspector } from "@/features/team/team-actions";
import { fill, type Dictionary } from "@/lib/i18n";

export type TeamDialogLabels = {
  dialogs: Dictionary["team"]["dialogs"];
  cancel: string;
  save: string;
};

function useSave(onOpenChange: (open: boolean) => void, savedMessage: string) {
  const [isSaving, startSaving] = useTransition();

  function save(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startSaving(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(savedMessage);
      onOpenChange(false);
    });
  }

  return { isSaving, save };
}

function DialogActions({ labels, isSaving }: { labels: TeamDialogLabels; isSaving: boolean }) {
  return (
    <DialogFooter>
      <DialogClose render={<Button variant="outline" />}>{labels.cancel}</DialogClose>
      <Button type="submit" disabled={isSaving}>
        {isSaving ? <Spinner /> : null}
        {labels.save}
      </Button>
    </DialogFooter>
  );
}

export function AddInspectorDialog({
  open,
  labels,
  onOpenChange,
}: {
  open: boolean;
  labels: TeamDialogLabels;
  onOpenChange: (open: boolean) => void;
}) {
  const { isSaving, save } = useSave(onOpenChange, labels.dialogs.saved);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    save(() =>
      createInspector({
        name: String(formData.get("name") ?? ""),
        note: String(formData.get("note") ?? ""),
      }),
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>{labels.dialogs.addTitle}</DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-name">{labels.dialogs.name}</FieldLabel>
              <Input id="team-name" name="name" required maxLength={80} autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="team-note">{labels.dialogs.note}</FieldLabel>
              <Textarea
                id="team-note"
                name="note"
                maxLength={500}
                placeholder={labels.dialogs.notePlaceholder}
              />
            </Field>
          </FieldGroup>
          <DialogActions labels={labels} isSaving={isSaving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EditInspectorDialog({
  member,
  labels,
  onOpenChange,
}: {
  member: { id: string; name: string; note: string | null } | null;
  labels: TeamDialogLabels;
  onOpenChange: (open: boolean) => void;
}) {
  const { isSaving, save } = useSave(onOpenChange, labels.dialogs.saved);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!member) {
      return;
    }
    const formData = new FormData(event.currentTarget);
    save(() =>
      updateInspector({
        id: member.id,
        name: String(formData.get("name") ?? ""),
        note: String(formData.get("note") ?? ""),
      }),
    );
  }

  return (
    <Dialog open={member !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-6" key={member?.id}>
          <DialogHeader>
            <DialogTitle>
              {fill(labels.dialogs.editTitle, { name: member?.name ?? "" })}
            </DialogTitle>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="team-edit-name">{labels.dialogs.name}</FieldLabel>
              <Input
                id="team-edit-name"
                name="name"
                required
                maxLength={80}
                defaultValue={member?.name ?? ""}
                autoFocus
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="team-edit-note">{labels.dialogs.note}</FieldLabel>
              <Textarea
                id="team-edit-note"
                name="note"
                maxLength={500}
                defaultValue={member?.note ?? ""}
                placeholder={labels.dialogs.notePlaceholder}
              />
            </Field>
          </FieldGroup>
          <DialogActions labels={labels} isSaving={isSaving} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
