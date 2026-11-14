import { expect, test } from "bun:test";

import { calendarDate, isVisitOverdue, visitActionsForStatus } from "./visit";

test("isVisitOverdue is true only for scheduled dates before today", () => {
  const today = "2026-11-10";
  expect(isVisitOverdue({ status: "scheduled", visitDate: "2026-11-09" }, today)).toBe(true);
  expect(isVisitOverdue({ status: "scheduled", visitDate: "2026-11-10" }, today)).toBe(false);
  expect(isVisitOverdue({ status: "lead", visitDate: "2026-11-01" }, today)).toBe(false);
  expect(isVisitOverdue({ status: "scheduled", visitDate: null }, today)).toBe(false);
});

test("visitActionsForStatus follows bowl status", () => {
  expect(visitActionsForStatus("lead")).toEqual(["schedule", "dismiss"]);
  expect(visitActionsForStatus("scheduled")).toEqual(["outcome", "dismiss"]);
  expect(visitActionsForStatus("inspected")).toEqual(["outcome"]);
  expect(visitActionsForStatus("closed")).toEqual(["restore"]);
  expect(visitActionsForStatus("dismissed")).toEqual(["restore"]);
});

test("calendarDate is an ISO calendar day", () => {
  expect(calendarDate(new Date("2026-11-10T15:04:00.000Z"))).toBe("2026-11-10");
});
