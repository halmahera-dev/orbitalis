import type { BowlStatus } from "@/features/bowls/bowls-queries";

export function isFarmingSite(bowl: { source: string }) {
  return bowl.source === "farming";
}

const leadOutcomes = ["pump_found", "no_pump", "natural"] as const;
const siteOutcomes = ["measures_working", "measures_failing"] as const;

export function outcomesFor(bowl: { source: string }) {
  return isFarmingSite(bowl) ? siteOutcomes : leadOutcomes;
}

export const statusDotColors: Record<BowlStatus, string> = {
  lead: "bg-brand",
  scheduled: "bg-chart-2",
  inspected: "bg-chart-3",
  closed: "bg-chart-5",
  dismissed: "bg-muted-foreground/40",
};

export type BowlVisitAction = "schedule" | "outcome" | "dismiss" | "restore";

const actionsByStatus: Record<BowlStatus, readonly BowlVisitAction[]> = {
  lead: ["schedule", "dismiss"],
  scheduled: ["outcome", "dismiss"],
  inspected: ["outcome"],
  closed: ["restore"],
  dismissed: ["restore"],
};

export function visitActionsForStatus(status: BowlStatus) {
  return actionsByStatus[status];
}

export function calendarDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function isVisitOverdue(
  bowl: { status: BowlStatus; visitDate: string | null },
  today = calendarDate(),
) {
  return bowl.status === "scheduled" && bowl.visitDate !== null && bowl.visitDate < today;
}
