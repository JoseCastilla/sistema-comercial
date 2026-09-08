import assert from "node:assert/strict";
import test from "node:test";

import { selectRecoveryAgendaItem } from "../dist/recovery-agenda.js";
import {
  classifyRecoveryWorkItem,
  compareRecoveryWorkNow,
  describeRecoveryWait,
  parseRecoveryWorkView,
  recoveryWorkNowRank,
} from "../dist/recovery-work-views.js";

// Martes 08/09/2026 a las 12:00 en Lima (17:00 UTC).
const ahora = new Date("2026-09-08T17:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

const base = {
  status: "IN_PROGRESS",
  nextActionAt: null,
  portabilityEligibleAt: null,
  lastResult: null,
  lastAttemptAt: null,
  pendingCommitmentAt: null,
};

function item(overrides) {
  return selectRecoveryAgendaItem({ ...base, ...overrides }, ahora);
}

test("la vista desconocida cae en Trabajar ahora", () => {
  assert.equal(parseRecoveryWorkView("espera"), "espera");
  assert.equal(parseRecoveryWorkView("todo"), "ahora");
});

test("un caso abierto está en exactamente una vista", () => {
  const casos = {
    verificacion: item({ status: "WAITING", lastResult: "YA_ACTIVO" }),
    citaFutura: item({
      status: "SCHEDULED",
      lastResult: "AGENDA",
      pendingCommitmentAt: lima("2026-09-09T10:00"),
    }),
    citaVencida: item({
      status: "SCHEDULED",
      lastResult: "AGENDA",
      pendingCommitmentAt: lima("2026-09-08T10:00"),
    }),
    vendido: item({ lastResult: "VENDIDO", nextActionAt: ahora }),
    noContactar: item({ lastResult: "NO_CONTACTAR", nextActionAt: ahora }),
    sinTelefonos: item({ lastResult: "NUMERO_ERRADO", nextActionAt: ahora, validPhoneCount: 0 }),
    pausaVigente: item({ lastResult: "RECHAZA", nextActionAt: lima("2026-09-09T12:00") }),
    pausaVencida: item({ lastResult: "RECHAZA", nextActionAt: lima("2026-09-08T09:00") }),
    sinGestion: item({ status: "ASSIGNED" }),
  };
  const vista = (key) => classifyRecoveryWorkItem(casos[key], ahora);

  assert.equal(vista("verificacion"), "espera");
  assert.equal(vista("citaFutura"), "espera");
  assert.equal(vista("citaVencida"), "ahora");
  assert.equal(vista("vendido"), "completar");
  assert.equal(vista("noContactar"), "completar");
  assert.equal(vista("sinTelefonos"), "completar");
  assert.equal(vista("pausaVigente"), "espera");
  assert.equal(vista("pausaVencida"), "ahora");
  assert.equal(vista("sinGestion"), "ahora");
});

test("la devolución de verificación se reconoce como origen y manda sobre el último resultado", () => {
  const devuelto = item({
    status: "ASSIGNED",
    lastResult: "YA_ACTIVO",
    lastAttemptAt: lima("2026-09-07T10:00"),
    nextActionAt: ahora,
    returnedFromVerificationAt: lima("2026-09-08T09:00"),
  });
  assert.equal(devuelto.kind, "REINTENTO");
  assert.equal(devuelto.origin, "devuelto");
  assert.equal(recoveryWorkNowRank(devuelto), 2);

  const antiguo = item({
    lastResult: "SIN_RESPUESTA",
    lastAttemptAt: lima("2026-09-08T11:00"),
    nextActionAt: ahora,
    returnedFromVerificationAt: lima("2026-09-07T09:00"),
  });
  assert.equal(antiguo.origin, "cadencia");
});

test("orden de Trabajar ahora: cita vencida, habilitación, devuelto, y después lo más reciente primero", () => {
  const cita = {
    item: item({ status: "SCHEDULED", lastResult: "AGENDA", pendingCommitmentAt: lima("2026-09-08T10:00") }),
    lastSightingAt: lima("2026-09-01T00:00"),
  };
  const habilitacion = {
    item: item({ status: "ASSIGNED", portabilityEligibleAt: lima("2026-09-07T00:00"), nextActionAt: ahora }),
    lastSightingAt: lima("2026-09-01T00:00"),
  };
  const devuelto = {
    item: item({ lastResult: "YA_ACTIVO", lastAttemptAt: lima("2026-09-07T10:00"), nextActionAt: ahora, returnedFromVerificationAt: lima("2026-09-08T09:00") }),
    lastSightingAt: lima("2026-09-01T00:00"),
  };
  const recienteHoy = {
    item: item({ lastResult: "SIN_RESPUESTA", nextActionAt: ahora }),
    lastSightingAt: lima("2026-09-08T08:00"),
  };
  const viejo = {
    item: item({ lastResult: "SIN_RESPUESTA", nextActionAt: lima("2026-09-05T09:00") }),
    lastSightingAt: lima("2026-09-05T08:00"),
  };

  const ordenados = [viejo, recienteHoy, devuelto, habilitacion, cita].sort(compareRecoveryWorkNow);
  assert.deepEqual(ordenados, [cita, habilitacion, devuelto, recienteHoy, viejo]);
});

test("cada espera dice por qué y cómo termina", () => {
  const pausa = describeRecoveryWait(item({ lastResult: "RECHAZA", nextActionAt: lima("2026-09-09T12:00") }));
  assert.match(pausa.reason, /no le interesa/);
  assert.match(pausa.ends, /Vuelve a tu cola/);

  const verificacion = describeRecoveryWait(item({ status: "WAITING", lastResult: "YA_ACTIVO" }));
  assert.match(verificacion.ends, /reporte de portabilidad/);

  const habilitacion = describeRecoveryWait(
    item({ status: "ASSIGNED", portabilityEligibleAt: lima("2026-09-20T00:00") }),
  );
  assert.match(habilitacion.ends, /Podrá portar desde/);
});
