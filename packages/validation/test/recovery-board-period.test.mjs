import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRecoveryBoardPeriod,
  resolveRecoveryBoardPeriod,
} from "../dist/recovery-board-period.js";

// Sábado 05/09/2026 a las 15:00 en Lima (20:00 UTC).
const ahora = new Date("2026-09-05T20:00:00.000Z");
const medianoche = (dia) => new Date(`${dia}T00:00:00-05:00`);

test("un período desconocido cae en «hoy»: el tablero siempre responde el día", () => {
  assert.equal(parseRecoveryBoardPeriod(undefined), "hoy");
  assert.equal(parseRecoveryBoardPeriod("trimestre"), "hoy");
  assert.equal(parseRecoveryBoardPeriod("semana"), "semana");
});

test("hoy y ayer son un día de Lima, de medianoche a medianoche", () => {
  assert.deepEqual(resolveRecoveryBoardPeriod("hoy", ahora), {
    key: "hoy",
    label: "Hoy",
    start: medianoche("2026-09-05"),
    end: medianoche("2026-09-06"),
    days: 1,
  });
  assert.deepEqual(resolveRecoveryBoardPeriod("ayer", ahora), {
    key: "ayer",
    label: "Ayer",
    start: medianoche("2026-09-04"),
    end: medianoche("2026-09-05"),
    days: 1,
  });
});

test("semana y mes incluyen hoy y cierran mañana a medianoche", () => {
  const semana = resolveRecoveryBoardPeriod("semana", ahora);
  const mes = resolveRecoveryBoardPeriod("mes", ahora);

  assert.deepEqual(
    [semana.start, semana.end, semana.days],
    [medianoche("2026-08-30"), medianoche("2026-09-06"), 7],
  );
  assert.deepEqual(
    [mes.start, mes.end, mes.days],
    [medianoche("2026-08-07"), medianoche("2026-09-06"), 30],
  );
});

test("ayer termina exactamente donde empieza hoy", () => {
  assert.equal(
    resolveRecoveryBoardPeriod("ayer", ahora).end.getTime(),
    resolveRecoveryBoardPeriod("hoy", ahora).start.getTime(),
  );
});

test("a las 23:30 de Lima el día sigue siendo el de Lima, no el de UTC", () => {
  // 04:30 UTC del 06/09 son las 23:30 de Lima del 05/09.
  const tarde = new Date("2026-09-06T04:30:00.000Z");

  assert.equal(
    resolveRecoveryBoardPeriod("hoy", tarde).start.getTime(),
    medianoche("2026-09-05").getTime(),
  );
});
