import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getOrderPeriodRange, parseOrderPeriod } from "../dist/index.js";

describe("order periods in America/Lima", () => {
  it("defaults invalid values to the current month", () => {
    assert.equal(parseOrderPeriod(undefined), "MONTH");
    assert.equal(parseOrderPeriod("ALL"), "MONTH");
  });

  it("calculates the Lima month using UTC instants", () => {
    const range = getOrderPeriodRange(
      "MONTH",
      new Date("2026-08-06T13:00:00.000Z"),
    );

    assert.equal(range.start.toISOString(), "2026-08-01T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-09-01T05:00:00.000Z");
  });

  it("does not let the current week cross into the previous month", () => {
    const range = getOrderPeriodRange(
      "WEEK",
      new Date("2026-08-02T16:00:00.000Z"),
    );

    assert.equal(range.start.toISOString(), "2026-08-01T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-08-03T05:00:00.000Z");
  });

  it("calculates today from Lima midnight", () => {
    const range = getOrderPeriodRange(
      "TODAY",
      new Date("2026-08-06T02:00:00.000Z"),
    );

    assert.equal(range.start.toISOString(), "2026-08-05T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-08-06T05:00:00.000Z");
  });
});
