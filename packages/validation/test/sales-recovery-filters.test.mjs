import assert from "node:assert/strict";
import test from "node:test";

import {
  parseSalesRecoveryView,
  pickFilterOption,
  salesRecoveryOpenStatusOptions,
  salesRecoveryOpenStatuses,
  salesRecoveryPriorityOptions,
  salesRecoveryResolvedStatusOptions,
  salesRecoveryResolvedStatuses,
} from "../dist/sales-recovery-filters.js";

test("la vista desconocida cae en abiertos: la bandeja es la cola de trabajo", () => {
  assert.equal(parseSalesRecoveryView("resueltos"), "resueltos");
  assert.equal(parseSalesRecoveryView("cerrados"), "abiertos");
  assert.equal(parseSalesRecoveryView(undefined), "abiertos");
});

test("abiertos y resueltos no comparten ningún estado", () => {
  for (const status of salesRecoveryOpenStatuses) {
    assert.ok(!salesRecoveryResolvedStatuses.includes(status), status);
  }
  assert.deepEqual(
    salesRecoveryOpenStatusOptions.map((option) => option.value),
    [...salesRecoveryOpenStatuses],
  );
  assert.deepEqual(
    salesRecoveryResolvedStatusOptions.map((option) => option.value),
    [...salesRecoveryResolvedStatuses],
  );
});

test("un filtro solo acepta valores de su lista", () => {
  assert.equal(pickFilterOption("ALTA", salesRecoveryPriorityOptions), "ALTA");
  assert.equal(pickFilterOption("URGENTE", salesRecoveryPriorityOptions), null);
  assert.equal(pickFilterOption("", salesRecoveryPriorityOptions), null);
});
