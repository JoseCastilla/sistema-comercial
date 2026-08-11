import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getOrderPeriodRange,
  getOrderRange,
  getLimaIsoDate,
  parseOrderPeriod,
  parseOrderRange,
} from "../dist/index.js";

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

  it("calculates yesterday across a month and year boundary", () => {
    const range = getOrderPeriodRange(
      "YESTERDAY",
      new Date("2027-01-01T15:00:00.000Z"),
    );

    assert.equal(range.start.toISOString(), "2026-12-31T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2027-01-01T05:00:00.000Z");
  });

  it("creates an inclusive custom date range as a semi-open UTC interval", () => {
    const range = getOrderRange(
      "2026-07-31",
      "2026-08-02",
      new Date("2026-08-08T15:00:00.000Z"),
    );

    assert.equal(range.start.toISOString(), "2026-07-31T05:00:00.000Z");
    assert.equal(range.end.toISOString(), "2026-08-03T05:00:00.000Z");
  });

  it("rejects incomplete, reversed and impossible custom ranges", () => {
    const now = new Date("2026-08-08T15:00:00.000Z");

    assert.equal(parseOrderRange(undefined, "2026-08-02", now), null);
    assert.equal(parseOrderRange("2026-08-03", "2026-08-02", now), null);
    assert.equal(parseOrderRange("2026-02-30", "2026-03-01", now), null);
    assert.equal(parseOrderRange("2026-08-01", "2026-08-09", now), null);
    assert.deepEqual(parseOrderRange("2026-08-01", "2026-08-08", now), {
      from: "2026-08-01",
      to: "2026-08-08",
    });
  });

  it("calculates the maximum range date in Lima", () => {
    assert.equal(
      getLimaIsoDate(new Date("2026-08-09T03:00:00.000Z")),
      "2026-08-08",
    );
  });
});
