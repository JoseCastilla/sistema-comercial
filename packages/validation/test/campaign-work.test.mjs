import assert from "node:assert/strict";
import test from "node:test";

import {
  campaignResolutionNote,
  campaignWorkActions,
  describeCampaignWorkDue,
  formatCampaignMoment,
} from "../dist/campaign-work.js";

// Jueves 24/09/2026 a las 11:00 en Lima (16:00 UTC).
const ahora = new Date("2026-09-24T16:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

function elemento(kind, at) {
  return {
    kind,
    origin: "cadencia",
    at,
    timed: kind === "CITA_ACORDADA",
    overdue: at !== null && at.getTime() < ahora.getTime(),
  };
}

test("una oportunidad vencida dice desde cuándo, en neutro (AC-001)", () => {
  assert.deepEqual(
    describeCampaignWorkDue(elemento("HABILITACION", lima("2026-09-12T09:00")), ahora),
    { label: "desde el 12/09", tone: "neutral" },
  );
  assert.deepEqual(
    describeCampaignWorkDue(elemento("REINTENTO", lima("2026-09-23T15:00")), ahora),
    { label: "hace 20 h", tone: "neutral" },
  );
});

test("la llamada acordada vencida es la única roja", () => {
  assert.deepEqual(
    describeCampaignWorkDue(elemento("CITA_ACORDADA", lima("2026-09-24T10:30")), ahora),
    { label: "venció hace 30 min", tone: "danger" },
  );
});

test("la llamada acordada próxima es ámbar; la lejana, neutra", () => {
  assert.deepEqual(
    describeCampaignWorkDue(elemento("CITA_ACORDADA", lima("2026-09-24T11:40")), ahora),
    { label: "en 40 min", tone: "warning" },
  );
  assert.deepEqual(
    describeCampaignWorkDue(elemento("CITA_ACORDADA", lima("2026-09-24T17:00")), ahora),
    { label: "a las 17:00", tone: "neutral" },
  );
});

test("lo que espera dice cuándo vuelve", () => {
  assert.deepEqual(
    describeCampaignWorkDue(elemento("REINTENTO", lima("2026-09-25T09:00")), ahora),
    { label: "el 25/09 a las 09:00", tone: "neutral" },
  );
});

test("sin fecha no hay plazo", () => {
  assert.equal(describeCampaignWorkDue(elemento("SIN_FECHA", null), ahora), null);
});

test("frases sin jerga y resolución con su consecuencia", () => {
  assert.equal(campaignWorkActions.HABILITACION, "Ya puede portar: llámalo");
  assert.equal(campaignWorkActions.REINTENTO, "Volver a llamar");
  assert.equal(
    campaignResolutionNote,
    "Lleva 7 días contigo: ciérralo o agenda una fecha",
  );
});

test("un solo formato de fecha: día/mes y hora de Lima", () => {
  assert.equal(formatCampaignMoment(lima("2026-09-08T12:40")), "08/09 12:40");
});
