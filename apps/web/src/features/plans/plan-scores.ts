import type { Cell } from "@/features/bowls/bowls-queries";

export const planKinds = ["recharge", "pipe"] as const;
export const planStatuses = ["proposed", "surveyed", "approved", "built"] as const;

export type PlanKind = (typeof planKinds)[number];
export type PlanStatus = (typeof planStatuses)[number];
export type PlanEntry = { cellId: string; kind: PlanKind; status: PlanStatus };

// Per-area coverage is not public. PAM Jaya reported 83.59% for the whole city in September 2026.
export const cityPipedShare = 0.8359;

export function peoplePerKm2(cell: Cell, cellSizeM: number) {
  return cell.people === null ? null : cell.people / (cellSizeM / 1000) ** 2;
}

export function unservedPeople(cell: Cell) {
  return cell.people === null ? null : Math.round(cell.people * (1 - cityPipedShare));
}

export function planScore(cell: Cell, kind: PlanKind) {
  const sinking = Math.max(cell.sinkingMmYr ?? 0, 0);
  const people = cell.people ?? 0;
  if (kind === "recharge") {
    return sinking * people;
  }
  return (unservedPeople(cell) ?? 0) * (1 + sinking / 30);
}
