import assert from "node:assert/strict";
import test from "node:test";

import {
  limaDayStartFromIso,
  limaHourMinute,
  limaWeekdayIndex,
  parseRecoveryAgendaDate,
  parseRecoveryAgendaView,
  recoveryAgendaGridHours,
  recoveryAgendaPeriod,
} from "../dist/recovery-agenda-period.js";

// Martes 08/09/2026 a las 12:00 en Lima (17:00 UTC).
const ahora = new Date("2026-09-08T17:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

test("la vista desconocida cae en semana", () => {
  assert.equal(parseRecoveryAgendaView("dia"), "dia");
  assert.equal(parseRecoveryAgendaView("mes"), "mes");
  assert.equal(parseRecoveryAgendaView("año"), "semana");
  assert.equal(parseRecoveryAgendaView(undefined), "semana");
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

test("la semana va de lunes a domingo y contiene la fecha pedida", () => {
  const periodo = recoveryAgendaPeriod("semana", lima("2026-09-10T00:00"));
  assert.equal(periodo.start.toISOString(), lima("2026-09-07T00:00").toISOString());
  assert.equal(periodo.end.toISOString(), lima("2026-09-14T00:00").toISOString());
  assert.equal(periodo.days.length, 7);
  assert.equal(periodo.previous.toISOString(), lima("2026-09-03T00:00").toISOString());
  assert.equal(periodo.next.toISOString(), lima("2026-09-17T00:00").toISOString());
});

test("el día es un solo día y la lista son siete desde la fecha", () => {
  const dia = recoveryAgendaPeriod("dia", lima("2026-09-10T00:00"));
  assert.equal(dia.days.length, 1);
  assert.equal(dia.end.toISOString(), lima("2026-09-11T00:00").toISOString());
  assert.equal(dia.next.toISOString(), lima("2026-09-11T00:00").toISOString());

  const lista = recoveryAgendaPeriod("lista", lima("2026-09-10T00:00"));
  assert.equal(lista.start.toISOString(), lima("2026-09-10T00:00").toISOString());
  assert.equal(lista.days.length, 7);
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

test("la cuadrícula cubre la jornada y se extiende a una cita fuera de ella", () => {
  assert.deepEqual(recoveryAgendaGridHours([]).slice(0, 2), [8, 9]);
  assert.equal(recoveryAgendaGridHours([]).at(-1), 20);
  assert.equal(recoveryAgendaGridHours([22])[0], 8);
  assert.equal(recoveryAgendaGridHours([22]).at(-1), 22);
  assert.equal(recoveryAgendaGridHours([6])[0], 6);
});
