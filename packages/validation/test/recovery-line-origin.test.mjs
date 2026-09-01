import assert from "node:assert/strict";
import test from "node:test";

import { describeRecoveryLineOrigin } from "../dist/recovery-line-origin.js";

const now = new Date("2026-09-01T17:00:00.000Z");

test("una línea que portó muestra su operador actual y la antigüedad", () => {
  const origin = describeRecoveryLineOrigin({
    carrierRaw: "CLARO",
    portabilityState: "PORTADO",
    portabilityReceiver: "Entel Perú S.A.",
    portabilityWindowAt: new Date("2026-08-09T05:00:00.000Z"),
    isPlantLine: false,
    now,
  });

  assert.equal(origin.operator, "ENTEL");
  assert.equal(origin.portedDaysAgo, 23);
  assert.equal(origin.detail, "portó hace 23 días");
});

test("una línea de planta declara que nunca portó, con el cedente de la base", () => {
  const origin = describeRecoveryLineOrigin({
    carrierRaw: "27",
    portabilityState: "NO_PORTADO",
    portabilityReceiver: null,
    portabilityWindowAt: null,
    isPlantLine: true,
    now,
  });

  assert.equal(origin.operator, "GUINEA");
  assert.equal(origin.detail, "línea de planta: nunca portó");
});

test("sin cruce todavía, se informa el cedente y que falta la consulta", () => {
  const origin = describeRecoveryLineOrigin({
    carrierRaw: "BITEL",
    portabilityState: null,
    portabilityReceiver: null,
    portabilityWindowAt: null,
    isPlantLine: false,
    now,
  });

  assert.equal(origin.operator, "BITEL");
  assert.equal(origin.detail, "sin consulta de portabilidad");
});

test("no portado con fecha conserva el cedente como operador actual", () => {
  const origin = describeRecoveryLineOrigin({
    carrierRaw: "CLARO",
    portabilityState: "NO_PORTADO",
    portabilityReceiver: "Viettel Perú S.A.C.(24)",
    portabilityWindowAt: new Date("2026-06-07T05:00:00.000Z"),
    isPlantLine: false,
    now,
  });

  assert.equal(origin.operator, "CLARO");
  assert.equal(origin.detail, "portó hace 86 días");
});
