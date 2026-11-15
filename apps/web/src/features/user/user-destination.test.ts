import { expect, test } from "bun:test";

import { guestDestinationPath } from "./user-destination";

test("guestDestinationPath sends map to /map and anything else to the desk", () => {
  expect(guestDestinationPath("en", "map")).toBe("/en/map");
  expect(guestDestinationPath("id", undefined)).toBe("/id");
  expect(guestDestinationPath("en", "admin")).toBe("/en");
  expect(guestDestinationPath("xx", "map")).toBe("/id/map");
});
