import assert from "node:assert/strict";
import test from "node:test";

import { detectRecoveryAttemptDiscrepancy } from "../dist/recovery-attempt-quality.js";

const kind = (result, observation) =>
  detectRecoveryAttemptDiscrepancy({ result, observation })?.kind ?? null;

test("una conversación registrada como no contesta se señala", () => {
  assert.equal(kind("SIN_RESPUESTA", "Interesado, me dice que lo llame mañana"), "agenda_sin_fecha");
  assert.equal(kind("SIN_RESPUESTA", "Le expliqué el plan y quiere pensarlo"), "contacto_como_no_contesta");
  assert.equal(kind("SIN_RESPUESTA", "buzón de voz"), null);
  assert.equal(kind("SIN_RESPUESTA", ""), null);
  assert.equal(kind("SIN_RESPUESTA", null), null);
});

test("un impedimento o un interés registrados como rechazo se señalan", () => {
  assert.equal(kind("RECHAZA", "Problema de huella, no pasó la validación"), "impedimento_como_rechazo");
  assert.equal(kind("RECHAZA", "Tiene deuda con su operador"), "impedimento_como_rechazo");
  assert.equal(kind("RECHAZA", "Está interesado pero no ahora"), "interes_como_rechazo");
  assert.equal(kind("RECHAZA", "No quiere cambiarse, está contento"), null);
});

test("«ya es Movistar» y «número equivocado» se señalan cuando el resultado no lo dice", () => {
  assert.equal(kind("SIN_RESPUESTA", "Dice que ya es Movistar desde julio"), "movistar_sin_verificar");
  assert.equal(kind("YA_ACTIVO", "Dice que ya es Movistar desde julio"), null);
  assert.equal(kind("RECHAZA", "Número equivocado, contestó otra persona"), "numero_errado_sin_marcar");
  assert.equal(kind("NUMERO_ERRADO", "Número equivocado"), null);
});

test("los acentos y mayúsculas no cambian la detección", () => {
  assert.equal(kind("SIN_RESPUESTA", "LLAMAR MAÑANA A LAS 10"), "agenda_sin_fecha");
  assert.equal(kind("RECHAZA", "PROBLEMA DE HUELLA"), "impedimento_como_rechazo");
});

test("un resultado coherente con su observación no se señala", () => {
  assert.equal(kind("INTERESADO", "Quiere el plan de 49.9, llamar mañana"), null);
  assert.equal(kind("VENDIDO", "Aceptó, se le tomó el pedido"), null);
  assert.equal(kind("IMPEDIMENTO", "Problema de huella, seguimiento el jueves"), null);
});
