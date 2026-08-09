import assert from "node:assert/strict";
import test from "node:test";

import {
  getPerformanceMonthRange,
  parsePerformanceMonth,
  shiftPerformanceMonth,
} from "../dist/performance-period.js";

test("usa el mes de Lima cuando la entrada no es válida", () => {
  assert.equal(
    parsePerformanceMonth("bad", new Date("2026-09-01T03:00:00.000Z")),
    "2026-08",
  );
});

test("no permite consultar meses futuros", () => {
  assert.equal(
    parsePerformanceMonth("2026-09", new Date("2026-08-09T15:00:00.000Z")),
    "2026-08",
  );
});

test("crea un rango mensual semiabierto en Lima", () => {
  const range = getPerformanceMonthRange("2026-08");

  assert.equal(range.start.toISOString(), "2026-08-01T05:00:00.000Z");
  assert.equal(range.end.toISOString(), "2026-09-01T05:00:00.000Z");
  assert.equal(range.from, "2026-08-01");
  assert.equal(range.to, "2026-08-31");
});

test("desplaza meses cruzando el año", () => {
  assert.equal(shiftPerformanceMonth("2026-01", -1), "2025-12");
  assert.equal(shiftPerformanceMonth("2025-12", 1), "2026-01");
});
