import assert from "node:assert/strict";
import test from "node:test";

import {
  eligibleFromReportedDate,
  previewRecoveryAttemptConsequence,
  recoveryAttemptChoices,
  recoveryAttemptFields,
  resolveRecoveryAttemptConsequence,
} from "../dist/recovery-attempt-consequences.js";

// Martes 08/09/2026 a las 12:00 en Lima (17:00 UTC).
const ahora = new Date("2026-09-08T17:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

const base = {
  now: ahora,
  attemptsToday: 1,
  managedSince: lima("2026-09-07T09:00"),
  isBaseCase: true,
};

test("cada resultado ofrecido tiene consecuencia declarada, y CANCELADO no se ofrece", () => {
  for (const choice of recoveryAttemptChoices) {
    const consequence = resolveRecoveryAttemptConsequence({
      ...base,
      result: choice.value,
      scheduledAt: lima("2026-09-09T10:00"),
      followUpDate: "2026-09-10",
      reportedDate: "2026-08-20",
      caseEligibleAt: lima("2026-09-19T00:00"),
      validPhonesLeft: 1,
    });
    assert.ok(consequence.summary.length > 0, choice.value);
    assert.ok(consequence.workView, choice.value);
  }
  assert.equal(
    recoveryAttemptChoices.some((choice) => choice.value === "CANCELADO"),
    false,
  );
  assert.equal(recoveryAttemptChoices[0].hotkey, "N");
});

test("no contesta sigue la cadencia: hoy hasta el tercero, mañana después", () => {
  const hoy = resolveRecoveryAttemptConsequence({ ...base, result: "SIN_RESPUESTA" });
  assert.equal(hoy.status, "IN_PROGRESS");
  assert.equal(hoy.nextActionAt.toISOString(), ahora.toISOString());
  assert.equal(hoy.workView, "ahora");
  assert.match(hoy.summary, /1 de 3/);

  const tercero = resolveRecoveryAttemptConsequence({
    ...base,
    result: "SIN_RESPUESTA",
    attemptsToday: 3,
  });
  assert.equal(tercero.nextActionAt.toISOString(), lima("2026-09-09T09:00").toISOString());
});

test("interesado: con hora acordada crea cita; con fecha, seguimiento a las 09:00; sin nada, cadencia", () => {
  const cita = resolveRecoveryAttemptConsequence({
    ...base,
    result: "INTERESADO",
    scheduledAt: lima("2026-09-09T10:00"),
  });
  assert.equal(cita.status, "SCHEDULED");
  assert.equal(cita.createsCommitment, true);
  assert.equal(cita.workView, "agenda");

  const seguimiento = resolveRecoveryAttemptConsequence({
    ...base,
    result: "INTERESADO",
    followUpDate: "2026-09-10",
  });
  assert.equal(seguimiento.status, "IN_PROGRESS");
  assert.equal(seguimiento.nextActionAt.toISOString(), lima("2026-09-10T09:00").toISOString());
  assert.equal(seguimiento.workView, "espera");

  const nada = resolveRecoveryAttemptConsequence({ ...base, result: "INTERESADO" });
  assert.equal(nada.workView, "ahora");
});

test("no interesado pausa; pedir que no lo llamen y aceptar van a Por completar", () => {
  const pausa = resolveRecoveryAttemptConsequence({ ...base, result: "RECHAZA", pauseDays: 2 });
  assert.equal(pausa.workView, "espera");
  assert.equal(pausa.nextActionAt.toISOString(), new Date(ahora.getTime() + 2 * 86400000).toISOString());

  const noContactar = resolveRecoveryAttemptConsequence({ ...base, result: "NO_CONTACTAR" });
  assert.equal(noContactar.workView, "completar");
  assert.equal(noContactar.nextActionAt.toISOString(), ahora.toISOString());

  const vendido = resolveRecoveryAttemptConsequence({ ...base, result: "VENDIDO" });
  assert.equal(vendido.workView, "completar");
  assert.match(vendido.summary, /vincula la orden/);
});

test("número errado marca el teléfono; sin teléfonos válidos va a Por completar", () => {
  const conOtro = resolveRecoveryAttemptConsequence({
    ...base,
    result: "NUMERO_ERRADO",
    phoneUsed: "999111222",
    validPhonesLeft: 1,
  });
  assert.equal(conOtro.invalidatesPhone, true);
  assert.equal(conOtro.workView, "ahora");
  assert.match(conOtro.summary, /999111222/);

  const sinOtro = resolveRecoveryAttemptConsequence({
    ...base,
    result: "NUMERO_ERRADO",
    validPhonesLeft: 0,
  });
  assert.equal(sinOtro.workView, "completar");
});

test("no cumple antigüedad: con fecha y sin otra línea, espera hasta la habilitación; con otra línea o sin fecha, sigue", () => {
  assert.equal(
    eligibleFromReportedDate("2026-08-20").toISOString(),
    lima("2026-09-19T00:00").toISOString(),
  );
  const espera = resolveRecoveryAttemptConsequence({
    ...base,
    result: "NO_CUMPLE_30D",
    reportedDate: "2026-08-20",
    caseEligibleAt: lima("2026-09-19T00:00"),
    anyWorkableLine: false,
  });
  assert.equal(espera.status, "SCHEDULED");
  assert.equal(espera.nextActionAt.toISOString(), lima("2026-09-19T00:00").toISOString());
  assert.equal(espera.workView, "espera");

  const otraLinea = resolveRecoveryAttemptConsequence({
    ...base,
    result: "NO_CUMPLE_30D",
    reportedDate: "2026-08-20",
    caseEligibleAt: lima("2026-09-19T00:00"),
    anyWorkableLine: true,
  });
  assert.equal(otraLinea.status, "IN_PROGRESS");
  assert.equal(otraLinea.workView, "ahora");

  const sinFecha = resolveRecoveryAttemptConsequence({ ...base, result: "NO_CUMPLE_30D" });
  assert.match(sinFecha.summary, /pedirle la fecha/);
});

test("tiene pedido es seguimiento ordinario; interesado con pedido va al frente; impedimento no es rechazo", () => {
  const tiene = resolveRecoveryAttemptConsequence({ ...base, result: "TIENE_PEDIDO" });
  assert.equal(tiene.status, "SCHEDULED");
  assert.equal(tiene.marksLinesForRevalidation, true);
  assert.equal(tiene.workView, "espera");

  const interesado = resolveRecoveryAttemptConsequence({ ...base, result: "INTERESADO_CON_PEDIDO" });
  assert.equal(interesado.workView, "ahora");

  const impedimento = resolveRecoveryAttemptConsequence({
    ...base,
    result: "IMPEDIMENTO",
    reason: "HUELLA",
    followUpDate: "2026-09-11",
    needsSupervisor: true,
  });
  assert.equal(impedimento.status, "IN_PROGRESS");
  assert.equal(impedimento.nextActionAt.toISOString(), lima("2026-09-11T09:00").toISOString());
  assert.match(impedimento.summary, /supervisor/);
});

test("los campos requeridos dependen del resultado", () => {
  assert.deepEqual(recoveryAttemptFields("AGENDA").required, ["scheduledAt"]);
  assert.deepEqual(recoveryAttemptFields("NO_CONTACTAR").required, ["observation"]);
  assert.deepEqual(recoveryAttemptFields("IMPEDIMENTO").required, [
    "impedimentReason",
    "observation",
    "followUpDate",
  ]);
  assert.deepEqual(recoveryAttemptFields("SIN_RESPUESTA").optional, ["reason"]);
  assert.deepEqual(recoveryAttemptFields("VENDIDO").required, []);
});

test("la vista previa se lee antes de guardar y no exige datos del servidor", () => {
  assert.match(previewRecoveryAttemptConsequence({ result: "", now: ahora }), /^$/);
  assert.match(
    previewRecoveryAttemptConsequence({ result: "RECHAZA", pauseDays: 1, now: ahora }),
    /pausado hasta/,
  );
  assert.match(
    previewRecoveryAttemptConsequence({
      result: "AGENDA",
      scheduledAtRaw: "2026-09-09T10:00",
      now: ahora,
    }),
    /agendado/,
  );
  assert.match(
    previewRecoveryAttemptConsequence({
      result: "NO_CUMPLE_30D",
      reportedDate: "2026-08-20",
      now: ahora,
    }),
    /Podrá portar/,
  );
});
