import assert from "node:assert/strict";
import test from "node:test";

import {
  isWithoutFirstContact,
  recoveryLastResultNone,
  recoveryNextActionBucket,
  recoveryNextActionBuckets,
  selectFollowUpCases,
} from "../dist/recovery-follow-up.js";

// Sábado 05/09/2026 a las 15:00 en Lima (20:00 UTC).
const ahora = new Date("2026-09-05T20:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

test("próxima acción: cuatro tramos excluyentes sobre la hora de Lima", () => {
  assert.equal(recoveryNextActionBucket(null, ahora), "sin");
  assert.equal(recoveryNextActionBucket(lima("2026-09-05T14:59"), ahora), "vencida");
  assert.equal(recoveryNextActionBucket(lima("2026-09-05T15:00"), ahora), "hoy");
  assert.equal(recoveryNextActionBucket(lima("2026-09-05T23:59"), ahora), "hoy");
  assert.equal(recoveryNextActionBucket(lima("2026-09-06T00:00"), ahora), "futura");
  assert.equal(recoveryNextActionBucket(lima("2026-09-20T09:00"), ahora), "futura");
});

test("«hoy» termina a medianoche de Lima, no de UTC", () => {
  // 23:30 de Lima del 05/09 son las 04:30 UTC del 06/09: sigue siendo hoy.
  const tarde = new Date("2026-09-06T04:30:00.000Z");

  assert.equal(recoveryNextActionBucket(lima("2026-09-05T23:45"), tarde), "hoy");
  assert.equal(recoveryNextActionBucket(lima("2026-09-06T00:15"), tarde), "futura");
});

test("los cuatro tramos cubren toda cartera sin repetir", () => {
  const casos = [
    { nextActionAt: null },
    { nextActionAt: lima("2026-09-01T10:00") },
    { nextActionAt: lima("2026-09-05T18:00") },
    { nextActionAt: lima("2026-09-09T10:00") },
  ];
  const conteo = Object.fromEntries(
    recoveryNextActionBuckets.map((tramo) => [
      tramo.value,
      casos.filter((c) => recoveryNextActionBucket(c.nextActionAt, ahora) === tramo.value).length,
    ]),
  );

  assert.deepEqual(conteo, { vencida: 1, hoy: 1, futura: 1, sin: 1 });
});

test("sin primer contacto excluye la espera: nadie tiene que llamarlo", () => {
  assert.equal(isWithoutFirstContact({ status: "ASSIGNED", firstContactAt: null }), true);
  assert.equal(isWithoutFirstContact({ status: "WAITING", firstContactAt: null }), false);
  assert.equal(
    isWithoutFirstContact({ status: "ASSIGNED", firstContactAt: lima("2026-09-04T10:00") }),
    false,
  );
});

const cartera = [
  {
    id: "a",
    status: "IN_PROGRESS",
    firstContactAt: lima("2026-09-05T09:00"),
    nextActionAt: lima("2026-09-05T18:00"),
    lastResult: "SIN_RESPUESTA",
    attemptsToday: 2,
  },
  {
    id: "b",
    status: "ASSIGNED",
    firstContactAt: null,
    nextActionAt: null,
    lastResult: null,
    attemptsToday: 0,
  },
  {
    id: "c",
    status: "SCHEDULED",
    firstContactAt: lima("2026-09-03T09:00"),
    nextActionAt: lima("2026-09-04T09:00"),
    lastResult: "AGENDA",
    attemptsToday: 0,
  },
  {
    id: "d",
    status: "WAITING",
    firstContactAt: null,
    nextActionAt: null,
    lastResult: "YA_ACTIVO",
    attemptsToday: 1,
  },
];
const ids = (lista) => lista.map((c) => c.id);

test("última tipificación filtra solo por el intento más reciente", () => {
  assert.deepEqual(ids(selectFollowUpCases(cartera, { lastResult: "SIN_RESPUESTA" }, ahora)), ["a"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { lastResult: "AGENDA" }, ahora)), ["c"]);
});

test("«sin gestión» es un valor propio: nunca tuvo intentos", () => {
  assert.deepEqual(
    ids(selectFollowUpCases(cartera, { lastResult: recoveryLastResultNone }, ahora)),
    ["b"],
  );
});

test("próxima acción, contacto, gestión de hoy y estado", () => {
  assert.deepEqual(ids(selectFollowUpCases(cartera, { nextAction: "vencida" }, ahora)), ["c"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { nextAction: "sin" }, ahora)), ["b", "d"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { contact: "sin" }, ahora)), ["b"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { contact: "con" }, ahora)), ["a", "c", "d"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { worked: "hoy" }, ahora)), ["a", "d"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { worked: "no" }, ahora)), ["b", "c"]);
  assert.deepEqual(ids(selectFollowUpCases(cartera, { status: "SCHEDULED" }, ahora)), ["c"]);
});

test("los filtros se combinan con AND y sin filtros devuelven toda la cartera", () => {
  assert.deepEqual(ids(selectFollowUpCases(cartera, {}, ahora)), ["a", "b", "c", "d"]);
  assert.deepEqual(
    ids(selectFollowUpCases(cartera, { worked: "hoy", nextAction: "hoy" }, ahora)),
    ["a"],
  );
  assert.deepEqual(
    ids(selectFollowUpCases(cartera, { worked: "hoy", contact: "sin" }, ahora)),
    [],
  );
});
