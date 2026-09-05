import assert from "node:assert/strict";
import test from "node:test";

import {
  describeInternalRecoveryStage,
  resolveInternalRecoveryTouchDay,
} from "../dist/recovery-internal-stage.js";

const ahora = new Date("2026-09-05T20:00:00.000Z");
const horas = (n) => new Date(ahora.getTime() + n * 60 * 60 * 1000);
const dias = (n) => horas(24 * n);

const base = {
  status: "ASSIGNED",
  firstContactAt: null,
  nextActionAt: null,
  noveltyAt: horas(-1),
  claimedAt: horas(-1),
  lastResult: null,
};

test("sin contacto manda el plazo de dos horas, y dice hasta qué hora", () => {
  const etapa = describeInternalRecoveryStage(base, ahora);

  assert.equal(etapa.key, "primer_contacto");
  assert.equal(etapa.label, "Primer contacto");
  assert.equal(etapa.due, null);
  // Se cayó a las 14:00 de Lima; el límite son las 16:00.
  assert.match(etapa.detail, /16:00/);

  const vencido = describeInternalRecoveryStage(
    { ...base, noveltyAt: horas(-3) },
    ahora,
  );
  assert.equal(vencido.label, "Primer contacto vencido");
  assert.equal(vencido.due, "primer_contacto");
});

test("con contacto, la próxima acción se reconoce como toque D1, D3 o D7", () => {
  const tomado = dias(-2);
  const contactado = {
    ...base,
    status: "IN_PROGRESS",
    firstContactAt: dias(-2),
    claimedAt: tomado,
  };

  assert.equal(resolveInternalRecoveryTouchDay(tomado, dias(1)), 3);
  assert.equal(resolveInternalRecoveryTouchDay(tomado, dias(5)), 7);
  assert.equal(resolveInternalRecoveryTouchDay(tomado, horas(2)), null);

  const d3 = describeInternalRecoveryStage(
    { ...contactado, nextActionAt: dias(1) },
    ahora,
  );
  assert.equal(d3.key, "toque");
  assert.equal(d3.label, "Toque D3");
  assert.equal(d3.touchDay, 3);
  assert.equal(d3.due, null);

  const d1Vencido = describeInternalRecoveryStage(
    { ...contactado, nextActionAt: dias(-1) },
    ahora,
  );
  assert.equal(d1Vencido.touchDay, 1);
  assert.equal(d1Vencido.due, "seguimiento");
});

test("una agenda acordada suspende la cadencia; una pasada es agenda vencida", () => {
  const agendado = { ...base, status: "SCHEDULED", firstContactAt: horas(-1) };

  const futura = describeInternalRecoveryStage(
    { ...agendado, nextActionAt: dias(1) },
    ahora,
  );
  assert.equal(futura.key, "agenda");
  assert.equal(futura.label, "Agenda acordada");
  assert.equal(futura.due, null);

  const pasada = describeInternalRecoveryStage(
    { ...agendado, nextActionAt: horas(-1) },
    ahora,
  );
  assert.equal(pasada.label, "Agenda vencida");
  assert.equal(pasada.due, "agenda");
});

test("un rechazo es una pausa, no un toque de la cadencia", () => {
  const rechazado = {
    ...base,
    status: "IN_PROGRESS",
    firstContactAt: horas(-1),
    lastResult: "RECHAZA",
  };

  assert.equal(
    describeInternalRecoveryStage(
      { ...rechazado, nextActionAt: dias(1) },
      ahora,
    ).key,
    "pausa",
  );
  const terminada = describeInternalRecoveryStage(
    { ...rechazado, nextActionAt: horas(-1) },
    ahora,
  );
  assert.equal(terminada.label, "Pausa terminada");
  assert.equal(terminada.due, "seguimiento");
});

test("en espera de confirmación está en verificación y nada vence", () => {
  const etapa = describeInternalRecoveryStage(
    { ...base, status: "WAITING", nextActionAt: horas(-5) },
    ahora,
  );

  assert.equal(etapa.key, "verificacion");
  assert.equal(etapa.due, null);
});

test("pasados los siete días sin próxima acción futura, la cadencia se agotó", () => {
  const etapa = describeInternalRecoveryStage(
    {
      ...base,
      status: "IN_PROGRESS",
      firstContactAt: dias(-8),
      claimedAt: dias(-8),
      // El toque D7 ya se registró: la próxima acción quedó en «ahora» de
      // entonces, no en un día de la cadencia.
      nextActionAt: horas(-12),
    },
    ahora,
  );

  assert.equal(etapa.key, "resolver");
  assert.equal(etapa.label, "Cadencia agotada");
});
