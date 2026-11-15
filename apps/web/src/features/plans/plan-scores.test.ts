import { describe, expect, test } from "bun:test";

import type { Cell } from "@/features/bowls/bowls-queries";

import { planScore, unservedPeople } from "./plan-scores";

function cell(sinkingMmYr: number | null, people: number | null): Cell {
  return {
    id: "c000-000",
    center: [106.8, -6.2],
    sinkingMmYr,
    uncertaintyMmYr: 5,
    coveredShare: 1,
    people,
  };
}

describe("plan scores", () => {
  test("recharge ranks a sinking, crowded cell above a rising one", () => {
    expect(planScore(cell(40, 1000), "recharge")).toBe(40_000);
    expect(planScore(cell(-10, 1000), "recharge")).toBe(0);
  });

  test("pipe priority still counts people where the ground does not sink", () => {
    expect(planScore(cell(-10, 1000), "pipe")).toBe(unservedPeople(cell(-10, 1000)));
    expect(planScore(cell(30, 1000), "pipe")).toBe(2 * (unservedPeople(cell(30, 1000)) ?? 0));
  });

  test("a cell with no population has no unserved people", () => {
    expect(unservedPeople(cell(10, null))).toBeNull();
    expect(planScore(cell(10, null), "pipe")).toBe(0);
  });
});
