import assert from "node:assert/strict";
import test from "node:test";

import {
  canAssignRecoveryCaseToOriginalAgent,
  evaluateInternalLossReasonGates,
  getHighestRecoveryPriority,
  getInternalRecoveryFirstActionAt,
  getInternalRecoveryNextTouchAt,
  getInternalRecoveryPauseUntil,
  getInternalRecoveryPriority,
  resolveInitialRecoveryAssignee,
  resolveInternalRecoveryEntryReason,
  shouldOpenInternalRecoveryCase,
} from "../dist/recovery-internal-gate.js";

test("solo canceladas y no entregadas abren la puerta interna", () => {
  assert.equal(shouldOpenInternalRecoveryCase({ status: "CANCELLED" }), true);
  assert.equal(
    shouldOpenInternalRecoveryCase({
      status: "SENT",
      sentSubstatus: "NOT_DELIVERED",
    }),
    true,
  );
  assert.equal(
    shouldOpenInternalRecoveryCase({ status: "SENT", sentSubstatus: "SCHEDULED" }),
    false,
  );
  assert.equal(shouldOpenInternalRecoveryCase({ status: "CLOSED" }), false);
  assert.equal(shouldOpenInternalRecoveryCase({ status: "OPEN" }), false);
});

test("una promesa comercial incorrecta nace crítica y no vuelve al originador", () => {
  const reason = resolveInternalRecoveryEntryReason({
    status: "CANCELLED",
    motivoRechazo: "RECHAZADO",
    submotivoRechazo: "LOS BENEFICIOS NO SON LOS OFRECIDOS",
  });

  assert.equal(reason, "PROMESA_COMERCIAL_INCORRECTA");
  assert.equal(getInternalRecoveryPriority(reason), "CRITICA");
  assert.equal(canAssignRecoveryCaseToOriginalAgent("CRITICA"), false);
  assert.equal(
    resolveInitialRecoveryAssignee({
      priority: "CRITICA",
      originalAgentUserId: "agent-1",
    }),
    null,
  );
});

test("cliente ausente en no entregado es alta y conserva al asesor original", () => {
  const reason = resolveInternalRecoveryEntryReason({
    status: "SENT",
    sentSubstatus: "NOT_DELIVERED",
    motivoRechazo: "CLIENTE AUSENTE",
    submotivoRechazo: null,
  });

  assert.equal(reason, "NO_ENTREGADO");
  assert.equal(getInternalRecoveryPriority(reason), "ALTA");
  assert.equal(
    resolveInitialRecoveryAssignee({
      priority: "ALTA",
      originalAgentUserId: "agent-1",
    }),
    "agent-1",
  );
});

test("deuda y antigüedad de porta quedan condicionadas a una fecha", () => {
  assert.equal(
    getInternalRecoveryPriority(
      resolveInternalRecoveryEntryReason({
        status: "CANCELLED",
        motivoRechazo: "TIENE DEUDA EXIGIBLE",
      }),
    ),
    "CONDICIONADA",
  );
  assert.equal(
    resolveInternalRecoveryEntryReason({
      status: "CANCELLED",
      motivoRechazo: "NO TRANSCURRIO EL TIEMPO MINIMO DE PORTA",
    }),
    "ANTIGUEDAD_PORTA",
  );
  assert.equal(
    resolveInternalRecoveryEntryReason({
      status: "CANCELLED",
      motivoRechazo: "TELEFONO NO ESTUVO EN SERVICIO",
    }),
    "ANTIGUEDAD_PORTA",
  );
});

test("un problema de dirección es incidencia logística, no falla del cliente", () => {
  const reason = resolveInternalRecoveryEntryReason({
    status: "SENT",
    sentSubstatus: "NOT_DELIVERED",
    motivoRechazo: "DIRECCION FUERA DE COBERTURA",
  });

  assert.equal(reason, "INCIDENCIA_LOGISTICA");
  assert.equal(getInternalRecoveryPriority(reason), "MEDIA");
});

test("una no entrega sin motivo del operador sigue siendo recuperable", () => {
  assert.equal(
    resolveInternalRecoveryEntryReason({
      status: "SENT",
      sentSubstatus: "NOT_DELIVERED",
      motivoRechazo: null,
      submotivoRechazo: null,
    }),
    "NO_ENTREGADO",
  );
});

test("al fusionar puertas el caso adopta la prioridad más alta", () => {
  assert.equal(getHighestRecoveryPriority("CONDICIONADA", "CRITICA"), "CRITICA");
  assert.equal(getHighestRecoveryPriority("ALTA", "MEDIA"), "ALTA");
  assert.equal(getHighestRecoveryPriority(null, "MEDIA"), "MEDIA");
  assert.equal(getHighestRecoveryPriority("ALTA", null), "ALTA");
  assert.equal(getHighestRecoveryPriority(null, null), null);
});

test("el primer contacto vence dos horas después de la novedad", () => {
  const novelty = new Date("2026-09-05T14:00:00.000Z");

  assert.equal(
    getInternalRecoveryFirstActionAt(novelty).toISOString(),
    "2026-09-05T16:00:00.000Z",
  );
});

test("la cadencia interna toca en los días 1, 3 y 7 y luego exige resolver", () => {
  const claimed = new Date("2026-09-01T15:00:00.000Z");

  assert.equal(
    getInternalRecoveryNextTouchAt(
      claimed,
      new Date("2026-09-01T18:00:00.000Z"),
    )?.toISOString(),
    "2026-09-02T15:00:00.000Z",
  );
  assert.equal(
    getInternalRecoveryNextTouchAt(
      claimed,
      new Date("2026-09-02T16:00:00.000Z"),
    )?.toISOString(),
    "2026-09-04T15:00:00.000Z",
  );
  assert.equal(
    getInternalRecoveryNextTouchAt(
      claimed,
      new Date("2026-09-06T10:00:00.000Z"),
    )?.toISOString(),
    "2026-09-08T15:00:00.000Z",
  );
  assert.equal(
    getInternalRecoveryNextTouchAt(
      claimed,
      new Date("2026-09-08T16:00:00.000Z"),
    ),
    null,
  );
});

function attempt(result, iso) {
  return { result, createdAt: new Date(iso) };
}

test("INUBICABLE exige tres días con tres intentos sin respuesta cada uno", () => {
  const twoDays = [
    attempt("SIN_RESPUESTA", "2026-09-01T14:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-01T16:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-01T18:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-02T14:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-02T16:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-02T18:00:00.000Z"),
  ];

  const partial = evaluateInternalLossReasonGates(twoDays);
  assert.equal(partial.INUBICABLE.enabled, false);
  assert.match(partial.INUBICABLE.missing, /llevas 2/);

  const complete = evaluateInternalLossReasonGates([
    ...twoDays,
    attempt("SIN_RESPUESTA", "2026-09-04T14:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-04T16:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-04T18:00:00.000Z"),
  ]);
  assert.equal(complete.INUBICABLE.enabled, true);
});

test("RECHAZO_DEFINITIVO exige dos rechazos en días distintos", () => {
  const sameDay = evaluateInternalLossReasonGates([
    attempt("RECHAZA", "2026-09-01T14:00:00.000Z"),
    attempt("RECHAZA", "2026-09-01T18:00:00.000Z"),
  ]);
  assert.equal(sameDay.RECHAZO_DEFINITIVO.enabled, false);

  const distinctDays = evaluateInternalLossReasonGates([
    attempt("RECHAZA", "2026-09-01T14:00:00.000Z"),
    attempt("RECHAZA", "2026-09-03T14:00:00.000Z"),
  ]);
  assert.equal(distinctDays.RECHAZO_DEFINITIVO.enabled, true);
});

test("los demás motivos exigen la evidencia de su intento", () => {
  const empty = evaluateInternalLossReasonGates([]);
  assert.equal(empty.DEUDA.enabled, false);
  assert.equal(empty.DATOS_INVALIDOS.enabled, false);
  assert.equal(empty.NO_PORTABLE.enabled, false);
  assert.equal(empty.YA_MIGRO_OTRA_AGENCIA.enabled, false);
  assert.equal(empty.OTRO.enabled, true);

  const evidenced = evaluateInternalLossReasonGates([
    attempt("INTERESADO", "2026-09-01T14:00:00.000Z"),
    attempt("NUMERO_ERRADO", "2026-09-01T15:00:00.000Z"),
    attempt("NO_CUMPLE_30D", "2026-09-01T16:00:00.000Z"),
  ]);
  assert.equal(evidenced.DEUDA.enabled, true);
  assert.equal(evidenced.DATOS_INVALIDOS.enabled, true);
  assert.equal(evidenced.NO_PORTABLE.enabled, true);
  assert.equal(evidenced.YA_MIGRO_OTRA_AGENCIA.enabled, true);
});

test("los días sin respuesta se cuentan en calendario de Lima", () => {
  // 04:00 UTC del día 2 sigue siendo el día 1 en Lima (UTC-5): un solo día.
  const gates = evaluateInternalLossReasonGates([
    attempt("SIN_RESPUESTA", "2026-09-01T20:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-01T23:00:00.000Z"),
    attempt("SIN_RESPUESTA", "2026-09-02T04:00:00.000Z"),
  ]);
  assert.match(gates.INUBICABLE.missing, /llevas 1/);
});

test("un rechazo pausa el caso uno o dos días exactos", () => {
  const now = new Date("2026-09-05T14:00:00.000Z");

  assert.equal(
    getInternalRecoveryPauseUntil(now, 1).toISOString(),
    "2026-09-06T14:00:00.000Z",
  );
  assert.equal(
    getInternalRecoveryPauseUntil(now, 2).toISOString(),
    "2026-09-07T14:00:00.000Z",
  );
});
