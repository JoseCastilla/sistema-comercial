import assert from "node:assert/strict";
import test from "node:test";

import {
  describeRecoveryCommitmentState,
  selectRecoveryAgendaItem,
  shareRecoveryAgendaSlot,
} from "../dist/recovery-agenda.js";

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

test("un caso resuelto no produce ningún elemento", () => {
  assert.equal(
    selectRecoveryAgendaItem({ ...base, status: "RECOVERED" }, ahora),
    null,
  );
  assert.equal(
    selectRecoveryAgendaItem({ ...base, status: "LOST" }, ahora),
    null,
  );
});

test("en verificación no ocupa hora ni exige llamada, aunque tenga cita pendiente", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      status: "WAITING",
      lastResult: "YA_ACTIVO",
      pendingCommitmentAt: lima("2026-09-09T10:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "VERIFICACION");
  assert.equal(item.at, null);
  assert.equal(item.timed, false);
});

test("la cita acordada es lo único que ocupa una hora, y manda sobre el centinela", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      status: "SCHEDULED",
      lastResult: "AGENDA",
      lastAttemptAt: lima("2026-09-08T09:00"),
      nextActionAt: lima("2026-09-09T10:00"),
      pendingCommitmentAt: lima("2026-09-09T10:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "CITA_ACORDADA");
  assert.equal(item.origin, "acuerdo");
  assert.equal(item.timed, true);
  assert.equal(item.overdue, false);
});

test("SCHEDULED sin cita pendiente no se inventa como cita (AG-R02)", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      status: "SCHEDULED",
      lastResult: "INTERESADO_CON_PEDIDO",
      lastAttemptAt: lima("2026-09-08T11:00"),
      nextActionAt: lima("2026-09-09T09:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "SEGUIMIENTO");
  assert.equal(item.timed, false);
});

test("una cita vencida sigue siendo cita y conserva su fecha (AG-R04)", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      status: "SCHEDULED",
      lastResult: "AGENDA",
      lastAttemptAt: lima("2026-09-07T09:00"),
      nextActionAt: lima("2026-09-08T10:00"),
      pendingCommitmentAt: lima("2026-09-08T10:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "CITA_ACORDADA");
  assert.equal(item.overdue, true);
  assert.equal(item.at.toISOString(), lima("2026-09-08T10:00").toISOString());
});

test("vendido sin resolver es «completar venta», sin hora", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      lastResult: "VENDIDO",
      lastAttemptAt: lima("2026-09-08T11:30"),
      nextActionAt: lima("2026-09-08T11:30"),
    },
    ahora,
  );
  assert.equal(item.kind, "COMPLETAR_VENTA");
  assert.equal(item.timed, false);
});

test("la habilitación es un recordatorio de fecha y nunca una cita", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      status: "ASSIGNED",
      portabilityEligibleAt: lima("2026-09-10T00:00"),
      nextActionAt: lima("2026-09-08T09:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "HABILITACION");
  assert.equal(item.origin, "habilitacion");
  assert.equal(item.timed, false);
  assert.equal(item.at.toISOString(), lima("2026-09-10T00:00").toISOString());
});

test("un intento posterior a la habilitación la da por trabajada: vuelve la cadencia", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      portabilityEligibleAt: lima("2026-09-07T00:00"),
      lastResult: "SIN_RESPUESTA",
      lastAttemptAt: lima("2026-09-08T11:00"),
      nextActionAt: lima("2026-09-08T11:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "REINTENTO");
  assert.equal(item.origin, "cadencia");
  assert.equal(item.overdue, true);
});

test("la pausa por rechazo se reconoce como origen del reintento", () => {
  const item = selectRecoveryAgendaItem(
    {
      ...base,
      lastResult: "RECHAZA",
      lastAttemptAt: lima("2026-09-08T11:00"),
      nextActionAt: lima("2026-09-09T11:00"),
    },
    ahora,
  );
  assert.equal(item.kind, "REINTENTO");
  assert.equal(item.origin, "pausa");
  assert.equal(item.overdue, false);
});

test("asignado sin gestión va a «pendientes sin fecha»", () => {
  const item = selectRecoveryAgendaItem(
    { ...base, status: "ASSIGNED" },
    ahora,
  );
  assert.equal(item.kind, "SIN_FECHA");
  assert.equal(item.at, null);
});

test("estado de la cita: pendiente o vencida según la hora; terminales por estado", () => {
  const futura = lima("2026-09-09T10:00");
  const pasada = lima("2026-09-08T10:00");
  assert.equal(
    describeRecoveryCommitmentState("PENDING", futura, ahora),
    "pendiente",
  );
  assert.equal(
    describeRecoveryCommitmentState("PENDING", pasada, ahora),
    "vencida",
  );
  assert.equal(
    describeRecoveryCommitmentState("DONE", pasada, ahora),
    "atendida",
  );
  assert.equal(
    describeRecoveryCommitmentState("RESCHEDULED", futura, ahora),
    "reprogramada",
  );
  assert.equal(
    describeRecoveryCommitmentState("CANCELLED", futura, ahora),
    "cancelada",
  );
});

test("dos citas comparten tramo si caen en los mismos 15 minutos", () => {
  assert.equal(
    shareRecoveryAgendaSlot(lima("2026-09-09T10:00"), lima("2026-09-09T10:14")),
    true,
  );
  assert.equal(
    shareRecoveryAgendaSlot(lima("2026-09-09T10:00"), lima("2026-09-09T10:16")),
    false,
  );
  assert.equal(
    shareRecoveryAgendaSlot(lima("2026-09-09T10:10"), lima("2026-09-09T10:20")),
    false,
  );
});
