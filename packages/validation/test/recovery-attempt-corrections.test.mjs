import assert from "node:assert/strict";
import test from "node:test";

import {
  canCorrectAttempt,
  correctableResults,
  effectiveAttemptResult,
  effectiveAttempts,
} from "../dist/recovery-attempt-corrections.js";
import { evaluateInternalLossReasonGates } from "../dist/recovery-internal-gate.js";

// Martes 08/09/2026 a las 12:00 en Lima (17:00 UTC).
const ahora = new Date("2026-09-08T17:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

test("el resultado efectivo es el rectificado si lo hay; la fecha no cambia", () => {
  const original = { result: "RECHAZA", createdAt: lima("2026-09-08T10:00") };
  const rectificado = {
    ...original,
    correction: { effectiveResult: "INTERESADO", effectiveReason: null },
  };
  assert.equal(effectiveAttemptResult(original), "RECHAZA");
  assert.equal(effectiveAttemptResult(rectificado), "INTERESADO");

  const [efectivo] = effectiveAttempts([rectificado]);
  assert.equal(efectivo.result, "INTERESADO");
  assert.equal(efectivo.originalResult, "RECHAZA");
  assert.equal(efectivo.corrected, true);
  assert.equal(efectivo.createdAt.toISOString(), original.createdAt.toISOString());
});

test("las puertas de pérdida leen el resultado efectivo: un rechazo rectificado no cuenta", () => {
  const dosRechazos = [
    { result: "RECHAZA", createdAt: lima("2026-09-07T10:00") },
    { result: "RECHAZA", createdAt: lima("2026-09-08T10:00") },
  ];
  assert.equal(evaluateInternalLossReasonGates(dosRechazos).RECHAZO_DEFINITIVO.enabled, true);

  const unoRectificado = effectiveAttempts([
    dosRechazos[0],
    { ...dosRechazos[1], correction: { effectiveResult: "INTERESADO" } },
  ]);
  assert.equal(
    evaluateInternalLossReasonGates(unoRectificado).RECHAZO_DEFINITIVO.enabled,
    false,
  );
});

test("agenda, antigüedad e impedimento no se rectifican: piden datos que la rectificación no tiene", () => {
  const values = correctableResults.map((option) => option.value);
  assert.ok(values.includes("INTERESADO"));
  assert.ok(!values.includes("AGENDA"));
  assert.ok(!values.includes("NO_CUMPLE_30D"));
  assert.ok(!values.includes("IMPEDIMENTO"));
  assert.ok(!values.includes("CANCELADO"));
});

test("ventana de rectificación: autor el mismo día, supervisor siete días, admin siempre", () => {
  const target = {
    actorUserId: "asesor",
    createdAt: lima("2026-09-08T09:00"),
    alreadyCorrected: false,
    caseResolved: false,
  };
  const autor = { role: "AGENT", userId: "asesor", supervisesCase: false };
  const otroAsesor = { role: "AGENT", userId: "otro", supervisesCase: false };
  const supervisor = { role: "SUPERVISOR", userId: "sup", supervisesCase: true };
  const supervisorAjeno = { role: "SUPERVISOR", userId: "sup2", supervisesCase: false };
  const admin = { role: "ADMIN", userId: "adm", supervisesCase: false };

  assert.equal(canCorrectAttempt(autor, target, ahora).allowed, true);
  assert.equal(canCorrectAttempt(otroAsesor, target, ahora).allowed, false);
  assert.equal(canCorrectAttempt(supervisor, target, ahora).allowed, true);
  assert.equal(canCorrectAttempt(supervisorAjeno, target, ahora).allowed, false);
  assert.equal(canCorrectAttempt(admin, target, ahora).allowed, true);

  // Al día siguiente el autor ya no puede; el supervisor sí hasta el séptimo.
  const manana = lima("2026-09-09T08:00");
  assert.equal(canCorrectAttempt(autor, target, manana).allowed, false);
  assert.match(canCorrectAttempt(autor, target, manana).reason, /mismo día/);
  assert.equal(canCorrectAttempt(supervisor, target, manana).allowed, true);
  const octavoDia = lima("2026-09-16T10:00");
  assert.equal(canCorrectAttempt(supervisor, target, octavoDia).allowed, false);
  assert.equal(canCorrectAttempt(admin, target, octavoDia).allowed, true);
});

test("un caso resuelto o un intento ya rectificado no se rectifican", () => {
  const admin = { role: "ADMIN", userId: "adm", supervisesCase: false };
  const base = {
    actorUserId: "asesor",
    createdAt: lima("2026-09-08T09:00"),
    alreadyCorrected: false,
    caseResolved: false,
  };
  assert.equal(canCorrectAttempt(admin, { ...base, caseResolved: true }, ahora).allowed, false);
  assert.equal(canCorrectAttempt(admin, { ...base, alreadyCorrected: true }, ahora).allowed, false);
});
