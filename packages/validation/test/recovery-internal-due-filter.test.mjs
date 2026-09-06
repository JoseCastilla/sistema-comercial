import assert from "node:assert/strict";
import test from "node:test";

import {
  internalRecoveryAnyDue,
  internalRecoveryDueFilterOptions,
  matchesInternalRecoveryDueFilter,
  parseInternalRecoveryDueFilter,
} from "../dist/recovery-internal-due.js";

/**
 * SPEC-045 PL-02: la alerta flotante abre «cualquier vencimiento», que es la
 * unión de los tres vencimientos de la bandeja, sin inventar un cuarto.
 */
test("«vencido» se acepta como filtro y no como vencimiento de un caso", () => {
  assert.equal(
    parseInternalRecoveryDueFilter("vencido"),
    internalRecoveryAnyDue,
  );
  assert.equal(parseInternalRecoveryDueFilter("agenda"), "agenda");
  assert.equal(parseInternalRecoveryDueFilter("otra cosa"), null);
  assert.equal(internalRecoveryDueFilterOptions[0].value, "vencido");
  assert.equal(internalRecoveryDueFilterOptions.length, 4);
});

test("«vencido» abre los tres vencimientos y nada más", () => {
  assert.equal(
    matchesInternalRecoveryDueFilter("primer_contacto", "vencido"),
    true,
  );
  assert.equal(
    matchesInternalRecoveryDueFilter("seguimiento", "vencido"),
    true,
  );
  assert.equal(matchesInternalRecoveryDueFilter("agenda", "vencido"), true);
  assert.equal(matchesInternalRecoveryDueFilter(null, "vencido"), false);
  assert.equal(
    matchesInternalRecoveryDueFilter("agenda", "seguimiento"),
    false,
  );
  assert.equal(matchesInternalRecoveryDueFilter(null, null), true);
});
