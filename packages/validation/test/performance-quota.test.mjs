import assert from "node:assert/strict";
import test from "node:test";

import {
  getDefaultQuotaTarget,
  isQuotaPeriodEditable,
  resolveCurrentAcceleratorWindow,
  resolveRelevantAcceleratorWindow,
  summarizeQuotaDistribution,
} from "../dist/index.js";

// 15:00 UTC es mediodia en Lima: el dia no se corre.
function atLimaNoon(day) {
  return new Date(`2026-08-${String(day).padStart(2, "0")}T15:00:00.000Z`);
}

test("resuelve la ventana vigente segun el dia de Lima", () => {
  assert.equal(resolveCurrentAcceleratorWindow(atLimaNoon(1))?.key, "ONE");
  assert.equal(resolveCurrentAcceleratorWindow(atLimaNoon(15))?.key, "ONE");
  assert.equal(resolveCurrentAcceleratorWindow(atLimaNoon(25))?.key, "TWO");
  assert.equal(resolveCurrentAcceleratorWindow(atLimaNoon(31))?.key, "TWO");
});

test("los dias 16 al 24 no tienen ventana vigente", () => {
  for (const day of [16, 20, 24]) {
    assert.equal(resolveCurrentAcceleratorWindow(atLimaNoon(day)), null);
  }
});

test("entre ventanas se habla de la ultima que cerro", () => {
  assert.equal(resolveRelevantAcceleratorWindow(atLimaNoon(20))?.key, "ONE");
  // Dentro de una ventana vigente, esa manda.
  assert.equal(resolveRelevantAcceleratorWindow(atLimaNoon(26))?.key, "TWO");
  // Antes de que cierre ninguna, no hay nada de que hablar.
  assert.equal(resolveRelevantAcceleratorWindow(atLimaNoon(3))?.key, "ONE");
});

test("la cuota por defecto es el primer tramo de cada ventana", () => {
  assert.equal(getDefaultQuotaTarget("ONE"), 30);
  assert.equal(getDefaultQuotaTarget("TWO"), 15);
});

test("repartir de menos advierte pero no bloquea", () => {
  const corto = summarizeQuotaDistribution({
    teamTarget: 100,
    advisorTargets: [30, 30, 25],
  });
  assert.equal(corto.assignedTarget, 85);
  assert.equal(corto.remaining, 15);
  assert.equal(corto.covers, false);

  const exacto = summarizeQuotaDistribution({
    teamTarget: 90,
    advisorTargets: [30, 30, 30],
  });
  assert.equal(exacto.remaining, 0);
  assert.equal(exacto.covers, true);

  const holgado = summarizeQuotaDistribution({
    teamTarget: 80,
    advisorTargets: [30, 30, 30],
  });
  assert.equal(holgado.remaining, -10);
  assert.equal(holgado.covers, true);
});

test("un periodo terminado queda congelado", () => {
  assert.equal(isQuotaPeriodEditable("2026-08", "2026-08"), true);
  assert.equal(isQuotaPeriodEditable("2026-09", "2026-08"), true);
  assert.equal(isQuotaPeriodEditable("2026-07", "2026-08"), false);
});
