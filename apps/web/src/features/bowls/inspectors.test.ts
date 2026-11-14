import { expect, test } from "bun:test";

import { defaultInspectorNames } from "./inspectors";

test("defaultInspectorNames seeds four field people", () => {
  expect(defaultInspectorNames).toHaveLength(4);
  expect(defaultInspectorNames).toContain("Ayu Sari");
  expect(defaultInspectorNames).toContain("Dimas Pratama");
});
