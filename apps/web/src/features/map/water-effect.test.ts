import { expect, test } from "bun:test";

import { waterEffect } from "./water-effect";

const body = { center: [106.8, -6.2] as [number, number], radiusM: 100 };

function cellAt(eastM: number, sinkingMmYr: number | null) {
  return { center: [106.8 + eastM / 110_670, -6.2] as [number, number], sinkingMmYr };
}

test("splits cells by distance to a water body and flags a clear difference", () => {
  const effect = waterEffect(
    [
      cellAt(0, 2),
      cellAt(300, 4),
      cellAt(550, 3),
      cellAt(2000, 30),
      cellAt(3000, 32),
      cellAt(4000, 31),
    ],
    [body],
  );
  expect(effect?.near.count).toBe(3);
  expect(effect?.far.count).toBe(3);
  expect(effect?.near.meanMmYr).toBeCloseTo(3);
  expect(effect?.isClear).toBe(true);
});

test("says the difference is not clear when the groups overlap", () => {
  const effect = waterEffect(
    [cellAt(0, 10), cellAt(300, 30), cellAt(2000, 12), cellAt(3000, 28)],
    [body],
  );
  expect(effect?.isClear).toBe(false);
});

test("returns nothing without enough measured cells on both sides", () => {
  expect(waterEffect([cellAt(0, 5), cellAt(100, null), cellAt(3000, 9)], [body])).toBeNull();
});
