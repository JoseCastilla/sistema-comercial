import assert from "node:assert/strict";
import test from "node:test";

import {
  isRecoveryCaseStale,
  recoveryDaysUntouched,
  selectFollowUpCases,
  summarizeFollowUpByAdvisor,
} from "../dist/recovery-follow-up.js";

// Viernes 25/09/2026 a las 16:00 en Lima.
const ahora = new Date("2026-09-25T21:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

function caso(extra = {}) {
  return {
    advisorId: "u-1",
    advisorName: "Silvia",
    status: "IN_PROGRESS",
    firstContactAt: lima("2026-09-03T10:00"),
    nextActionAt: lima("2026-09-03T10:00"),
    lastResult: "SIN_RESPUESTA",
    attemptsToday: 0,
    attemptsInPeriod: 0,
    lastAttemptAt: lima("2026-09-03T10:19"),
    claimedAt: lima("2026-09-02T09:00"),
    hasPendingCommitment: false,
    ...extra,
  };
}

test("sin tocar se cuenta desde la última gestión o, sin gestiones, desde la asignación", () => {
  assert.equal(recoveryDaysUntouched(caso(), ahora), 22);
  assert.equal(
    recoveryDaysUntouched(
      caso({ lastAttemptAt: null, claimedAt: lima("2026-09-20T09:00") }),
      ahora,
    ),
    5,
  );
  assert.equal(
    recoveryDaysUntouched(caso({ lastAttemptAt: null, claimedAt: null }), ahora),
    null,
  );
});

test("se puede devolver lo que lleva 7 días sin gestión, sin cita ni verificación", () => {
  assert.equal(isRecoveryCaseStale(caso(), ahora), true);
  assert.equal(
    isRecoveryCaseStale(caso({ lastAttemptAt: lima("2026-09-20T10:00") }), ahora),
    false,
  );
  assert.equal(
    isRecoveryCaseStale(caso({ hasPendingCommitment: true }), ahora),
    false,
  );
  assert.equal(isRecoveryCaseStale(caso({ status: "WAITING" }), ahora), false);
  assert.equal(isRecoveryCaseStale(caso({ status: "SCHEDULED" }), ahora), false);
});

test("el filtro «sin tocar desde» estrecha por días sin gestión", () => {
  const casos = [
    caso(),
    caso({ lastAttemptAt: lima("2026-09-23T10:00") }),
    caso({ lastAttemptAt: lima("2026-09-25T10:00"), attemptsToday: 1 }),
  ];

  assert.equal(selectFollowUpCases(casos, { idle: "7" }, ahora).length, 1);
  assert.equal(selectFollowUpCases(casos, { idle: "3" }, ahora).length, 1);
  assert.equal(selectFollowUpCases(casos, { idle: "hoy" }, ahora).length, 2);
});

test("por asesor: primero quien más tiene sin tocar", () => {
  const resumen = summarizeFollowUpByAdvisor(
    [
      caso(),
      caso({ hasPendingCommitment: true }),
      caso({
        advisorId: "u-2",
        advisorName: "Steven",
        lastAttemptAt: lima("2026-09-25T09:50"),
        attemptsToday: 4,
      }),
      caso({
        advisorId: "u-2",
        advisorName: "Steven",
        status: "SCHEDULED",
        nextActionAt: lima("2026-09-24T10:00"),
        lastAttemptAt: lima("2026-09-23T10:00"),
      }),
    ],
    ahora,
  );

  assert.deepEqual(
    resumen.map((item) => [item.name, item.portfolio, item.stale, item.releasable]),
    [
      ["Silvia", 2, 2, 1],
      ["Steven", 2, 0, 0],
    ],
  );
  assert.equal(resumen[1].workedToday, 1);
  assert.equal(resumen[1].agendaOverdue, 1);
});
