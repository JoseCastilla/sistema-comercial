import assert from "node:assert/strict";
import test from "node:test";

import {
  compareMyDayItems,
  describeMyDayDue,
  describeMyDaySince,
  formatMyDayTime,
  formatMyDaySaleDay,
  isMyDayHotSale,
  placeMyDayCommitment,
  placeMyDayOrder,
  placeMyDaySalesRecovery,
} from "../dist/my-day.js";

// Jueves 24/09/2026 a las 11:00 en Lima (16:00 UTC).
const ahora = new Date("2026-09-24T16:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

test("una cita pasada es el tramo más urgente", () => {
  assert.deepEqual(placeMyDayCommitment(lima("2026-09-24T10:30:00"), ahora), {
    tier: "cita_vencida",
    bucket: "ahora",
    dueAt: lima("2026-09-24T10:30:00"),
  });
});

test("una cita dentro de 2 horas va en «ahora»; más tarde hoy, plegada", () => {
  assert.equal(
    placeMyDayCommitment(lima("2026-09-24T12:30:00"), ahora).bucket,
    "ahora",
  );
  assert.equal(
    placeMyDayCommitment(lima("2026-09-24T13:00:00"), ahora).bucket,
    "ahora",
  );
  assert.deepEqual(placeMyDayCommitment(lima("2026-09-24T16:00:00"), ahora), {
    tier: "cita_pronto",
    bucket: "hoy",
    dueAt: lima("2026-09-24T16:00:00"),
  });
});

test("una cita de mañana no es de hoy, aunque falten menos de 24 horas", () => {
  assert.equal(placeMyDayCommitment(lima("2026-09-25T09:00:00"), ahora), null);
});

test("el día se corta en Lima: las 23:30 de Lima son hoy aunque en UTC sea mañana", () => {
  assert.equal(
    placeMyDayCommitment(lima("2026-09-24T23:30:00"), ahora).bucket,
    "hoy",
  );
});

const recupero = (overrides = {}) => ({
  status: "ASSIGNED",
  saleAt: lima("2026-09-23T15:00:00"),
  firstContactAt: null,
  nextActionAt: null,
  firstActionAt: lima("2026-09-24T12:00:00"),
  due: null,
  ...overrides,
});

test("sin primer contacto es venta en riesgo aunque el plazo no haya vencido", () => {
  assert.deepEqual(placeMyDaySalesRecovery(recupero(), ahora), {
    tier: "venta_en_riesgo",
    bucket: "ahora",
    dueAt: lima("2026-09-24T12:00:00"),
  });
});

test("con contacto, solo sube a «ahora» si su seguimiento venció", () => {
  const contactado = {
    firstContactAt: lima("2026-09-23T10:00:00"),
    nextActionAt: lima("2026-09-24T09:00:00"),
    status: "IN_PROGRESS",
  };
  assert.deepEqual(
    placeMyDaySalesRecovery(recupero({ ...contactado, due: "seguimiento" }), ahora),
    {
      tier: "seguimiento_vencido",
      bucket: "ahora",
      dueAt: lima("2026-09-24T09:00:00"),
    },
  );
});

test("un seguimiento de más tarde hoy va plegado; el de mañana no aparece", () => {
  const base = {
    firstContactAt: lima("2026-09-23T10:00:00"),
    status: "IN_PROGRESS",
  };
  assert.equal(
    placeMyDaySalesRecovery(
      recupero({ ...base, nextActionAt: lima("2026-09-24T17:00:00") }),
      ahora,
    ).bucket,
    "hoy",
  );
  assert.equal(
    placeMyDaySalesRecovery(
      recupero({ ...base, nextActionAt: lima("2026-09-25T10:00:00") }),
      ahora,
    ),
    null,
  );
});

test("en verificación no hay nada que hacer", () => {
  assert.equal(placeMyDaySalesRecovery(recupero({ status: "WAITING" }), ahora), null);
});

test("AC-001: el orden es por tramo, luego por plazo, luego por el orden del módulo", () => {
  const items = [
    { id: "campana-2", tier: "campana", dueAt: null, rank: 2 },
    { id: "pedido", tier: "pedido", dueAt: lima("2026-09-24T08:00:00"), rank: 0 },
    { id: "cita-pronto", tier: "cita_pronto", dueAt: lima("2026-09-24T12:30:00"), rank: 0 },
    { id: "campana-1", tier: "campana", dueAt: null, rank: 1 },
    { id: "riesgo", tier: "venta_en_riesgo", dueAt: lima("2026-09-24T11:40:00"), rank: 0 },
    { id: "cita-vencida-2", tier: "cita_vencida", dueAt: lima("2026-09-24T10:45:00"), rank: 0 },
    { id: "cita-vencida-1", tier: "cita_vencida", dueAt: lima("2026-09-24T09:00:00"), rank: 0 },
    { id: "seguimiento", tier: "seguimiento_vencido", dueAt: null, rank: 0 },
  ];

  assert.deepEqual(
    [...items].sort(compareMyDayItems).map((item) => item.id),
    [
      "cita-vencida-1",
      "cita-vencida-2",
      "riesgo",
      "cita-pronto",
      "pedido",
      "seguimiento",
      "campana-1",
      "campana-2",
    ],
  );
});

test("dentro de un tramo, lo que tiene plazo va antes que lo que no", () => {
  const conPlazo = { tier: "pedido", dueAt: lima("2026-09-24T08:00:00"), rank: 5 };
  const sinPlazo = { tier: "pedido", dueAt: null, rank: 0 };
  assert.ok(compareMyDayItems(conPlazo, sinPlazo) < 0);
});

test("el plazo en palabras del asesor", () => {
  assert.equal(describeMyDayDue(lima("2026-09-24T10:35:00"), ahora), "venció hace 25 min");
  assert.equal(describeMyDayDue(lima("2026-09-24T08:00:00"), ahora), "venció hace 3 h");
  assert.equal(
    describeMyDayDue(lima("2026-09-22T08:00:00"), ahora),
    "vencida desde el 22/09",
  );
  assert.equal(describeMyDayDue(lima("2026-09-24T11:40:00"), ahora), "en 40 min");
  assert.equal(describeMyDayDue(lima("2026-09-24T15:00:00"), ahora), "a las 15:00");
  assert.equal(
    describeMyDayDue(lima("2026-09-25T09:30:00"), ahora),
    "el 25/09 a las 09:30",
  );
});

test("BR-018: caliente es la venta de hoy o de los 6 días anteriores, en fecha de Lima", () => {
  assert.equal(isMyDayHotSale(lima("2026-09-24T09:00:00"), ahora), true);
  assert.equal(isMyDayHotSale(lima("2026-09-18T00:05:00"), ahora), true);
  assert.equal(isMyDayHotSale(lima("2026-09-17T23:55:00"), ahora), false);
  assert.equal(isMyDayHotSale(lima("2026-08-20T10:00:00"), ahora), false);
});

test("BR-018: la venta caída fría no compite con la caliente", () => {
  assert.deepEqual(
    placeMyDaySalesRecovery(recupero({ saleAt: lima("2026-08-20T10:00:00") }), ahora),
    {
      tier: "venta_en_riesgo",
      bucket: "frio",
      dueAt: lima("2026-09-24T12:00:00"),
    },
  );
});

test("BR-018: el pedido con incidencia de una venta antigua también es frío", () => {
  assert.equal(placeMyDayOrder(lima("2026-09-22T10:00:00"), null, ahora).bucket, "ahora");
  assert.equal(placeMyDayOrder(lima("2026-08-12T10:00:00"), null, ahora).bucket, "frio");
});

test("BR-018: entre ventas caídas, la más reciente primero", () => {
  const items = [
    { id: "hace-5-dias", tier: "venta_en_riesgo", dueAt: lima("2026-09-19T12:00:00"), rank: 0 },
    { id: "hoy", tier: "venta_en_riesgo", dueAt: lima("2026-09-24T12:00:00"), rank: 1 },
    { id: "ayer", tier: "venta_en_riesgo", dueAt: lima("2026-09-23T17:00:00"), rank: 2 },
  ];
  assert.deepEqual(
    [...items].sort(compareMyDayItems).map((item) => item.id),
    ["hoy", "ayer", "hace-5-dias"],
  );
});

test("la fecha de la venta se escribe con día y mes de Lima", () => {
  assert.equal(formatMyDaySaleDay(lima("2026-08-05T23:30:00")), "05/08");
});

test("desde cuándo, sin reproche: minutos, horas, fecha", () => {
  assert.equal(describeMyDaySince(lima("2026-09-24T10:35:00"), ahora), "hace 25 min");
  assert.equal(describeMyDaySince(lima("2026-09-24T06:00:00"), ahora), "hace 5 h");
  assert.equal(describeMyDaySince(lima("2026-09-12T10:00:00"), ahora), "desde el 12/09");
});

test("la hora se escribe en Lima con dos dígitos", () => {
  assert.equal(formatMyDayTime(lima("2026-09-24T09:05:00")), "09:05");
  assert.equal(formatMyDayTime(lima("2026-09-24T19:41:00")), "19:41");
});
