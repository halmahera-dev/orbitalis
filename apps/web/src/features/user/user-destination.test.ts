import { expect, test } from "bun:test";

import { guestDestinationPath, safeLocalPath } from "./user-destination";

test("safeLocalPath keeps paths on this site and refuses other sites", () => {
  expect(safeLocalPath("/en/map?show=farming", "/id/map")).toBe("/en/map?show=farming");
  expect(safeLocalPath("//evil.example", "/id/map")).toBe("/id/map");
  expect(safeLocalPath("/\\evil.example", "/id/map")).toBe("/id/map");
  expect(safeLocalPath("https://evil.example", "/id/map")).toBe("/id/map");
  expect(safeLocalPath(null, "/id/map")).toBe("/id/map");
});

test("guestDestinationPath sends map to /map and anything else to the desk", () => {
  expect(guestDestinationPath("en", "map")).toBe("/en/map");
  expect(guestDestinationPath("id", undefined)).toBe("/id");
  expect(guestDestinationPath("en", "admin")).toBe("/en");
  expect(guestDestinationPath("xx", "map")).toBe("/id/map");
});
