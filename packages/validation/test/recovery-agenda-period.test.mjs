import assert from "node:assert/strict";
import test from "node:test";

import {
  limaDayStartFromIso,
  limaHourMinute,
  limaWeekdayIndex,
  parseRecoveryAgendaDate,
  parseRecoveryAgendaView,
  recoveryAgendaPeriod,
} from "../dist/recovery-agenda-period.js";

// Martes 08/09/2026 a las 12:00 en Lima (17:00 UTC).
const ahora = new Date("2026-09-08T17:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

test("la vista desconocida, o una retirada, cae en «Próximas»", () => {
  assert.equal(parseRecoveryAgendaView("mes"), "mes");
  assert.equal(parseRecoveryAgendaView("semana"), "proximas");
  assert.equal(parseRecoveryAgendaView("dia"), "proximas");
  assert.equal(parseRecoveryAgendaView("año"), "proximas");
  assert.equal(parseRecoveryAgendaView(undefined), "proximas");
});

test("una fecha es medianoche de Lima; una inválida es hoy", () => {
  assert.equal(
    limaDayStartFromIso("2026-09-09").toISOString(),
    "2026-09-09T05:00:00.000Z",
  );
  assert.equal(limaDayStartFromIso("2026-02-31"), null);
  assert.equal(limaDayStartFromIso("ayer"), null);
  assert.equal(
    parseRecoveryAgendaDate("2026-02-31", ahora).toISOString(),
    "2026-09-08T05:00:00.000Z",
  );
});

test("el índice de la semana empieza en lunes", () => {
  assert.equal(limaWeekdayIndex(lima("2026-09-07T00:00")), 0); // lunes
  assert.equal(limaWeekdayIndex(lima("2026-09-08T00:00")), 1); // martes
  assert.equal(limaWeekdayIndex(lima("2026-09-13T00:00")), 6); // domingo
});

test("«Próximas» son catorce días desde la fecha y avanza de a catorce", () => {
  const periodo = recoveryAgendaPeriod("proximas", lima("2026-09-10T00:00"));
  assert.equal(periodo.start.toISOString(), lima("2026-09-10T00:00").toISOString());
  assert.equal(periodo.end.toISOString(), lima("2026-09-24T00:00").toISOString());
  assert.equal(periodo.days.length, 14);
  assert.equal(periodo.previous.toISOString(), lima("2026-08-27T00:00").toISOString());
  assert.equal(periodo.next.toISOString(), lima("2026-09-24T00:00").toISOString());
});

test("el mes es una rejilla de semanas completas que cubre el mes elegido", () => {
  // Setiembre de 2026: empieza martes 1 y termina miércoles 30.
  const periodo = recoveryAgendaPeriod("mes", lima("2026-09-10T00:00"));
  assert.equal(periodo.monthStart.toISOString(), lima("2026-09-01T00:00").toISOString());
  assert.equal(periodo.monthEnd.toISOString(), lima("2026-10-01T00:00").toISOString());
  // Lunes 31/08 → domingo 04/10: cinco semanas.
  assert.equal(periodo.start.toISOString(), lima("2026-08-31T00:00").toISOString());
  assert.equal(periodo.end.toISOString(), lima("2026-10-05T00:00").toISOString());
  assert.equal(periodo.days.length, 35);
  assert.equal(periodo.previous.toISOString(), lima("2026-08-01T00:00").toISOString());
  assert.equal(periodo.next.toISOString(), lima("2026-10-01T00:00").toISOString());
});

test("cambiar de mes cruza el año sin perder el día 1", () => {
  const periodo = recoveryAgendaPeriod("mes", lima("2026-12-15T00:00"));
  assert.equal(periodo.next.toISOString(), lima("2027-01-01T00:00").toISOString());
  assert.equal(
    recoveryAgendaPeriod("mes", lima("2027-01-15T00:00")).previous.toISOString(),
    lima("2026-12-01T00:00").toISOString(),
  );
});

test("hora y minuto de Lima no dependen de la zona del proceso", () => {
  assert.deepEqual(limaHourMinute(lima("2026-09-09T10:15")), {
    hour: 10,
    minute: 15,
  });
  assert.deepEqual(limaHourMinute(new Date("2026-09-10T01:30:00.000Z")), {
    hour: 20,
    minute: 30,
  });
});
