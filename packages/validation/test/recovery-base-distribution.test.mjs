import assert from "node:assert/strict";
import test from "node:test";

import {
  baseRecoveryMinimumDailyAttempts,
  baseRecoveryPoolTakeLimit,
  countOnSameLimaDay,
  distributeCasesEquitably,
  getBaseRecoveryNextTouchAt,
  getBaseRecoveryResolutionDueAt,
  isBaseRecoveryResolutionDue,
  shouldReturnBaseCaseToPool,
} from "../dist/recovery-base-distribution.js";

function caseIds(count) {
  return Array.from({ length: count }, (_, index) => `case-${index + 1}`);
}

test("el reparto equitativo mantiene diferencia máxima de un caso", () => {
  const assignments = distributeCasesEquitably({
    orderedCaseIds: caseIds(17),
    advisors: [
      { userId: "ana", openCases: 0 },
      { userId: "beto", openCases: 0 },
      { userId: "carla", openCases: 0 },
      { userId: "dario", openCases: 0 },
      { userId: "elsa", openCases: 0 },
    ],
  });

  assert.equal(assignments.length, 17);

  const counts = new Map();
  for (const { userId } of assignments) {
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }
  const sizes = [...counts.values()];
  assert.equal(Math.max(...sizes) - Math.min(...sizes), 1);
  assert.equal(counts.size, 5);
});

test("el residuo cae en los asesores con menos casos abiertos", () => {
  // 7 casos entre 3 asesores: dos reciben 3 y uno recibe... no: 3+2+2.
  // El extra de la ronda incompleta debe ir a quien menos carga.
  const assignments = distributeCasesEquitably({
    orderedCaseIds: caseIds(7),
    advisors: [
      { userId: "cargado", openCases: 12 },
      { userId: "libre", openCases: 0 },
      { userId: "medio", openCases: 5 },
    ],
  });

  const counts = new Map();
  for (const { userId } of assignments) {
    counts.set(userId, (counts.get(userId) ?? 0) + 1);
  }

  assert.equal(counts.get("libre"), 3);
  assert.equal(counts.get("medio"), 2);
  assert.equal(counts.get("cargado"), 2);
});

test("la ronda mezcla prioridades: nadie recibe un bloque contiguo", () => {
  // Los primeros de la cola son los urgentes (BR-028c): en ronda, cada
  // asesor recibe uno de los tres primeros, no un bloque de buenos para uno.
  const assignments = distributeCasesEquitably({
    orderedCaseIds: caseIds(9),
    advisors: [
      { userId: "a", openCases: 0 },
      { userId: "b", openCases: 0 },
      { userId: "c", openCases: 0 },
    ],
  });

  const firstRound = assignments.slice(0, 3).map((item) => item.userId);
  assert.deepEqual(new Set(firstRound).size, 3);

  // Cada asesor recibe exactamente un caso por ronda.
  const byUser = new Map();
  for (const { caseId, userId } of assignments) {
    const list = byUser.get(userId) ?? [];
    list.push(caseId);
    byUser.set(userId, list);
  }
  assert.deepEqual(byUser.get("a"), ["case-1", "case-4", "case-7"]);
});

test("sin asesores elegibles no hay reparto", () => {
  assert.deepEqual(
    distributeCasesEquitably({ orderedCaseIds: caseIds(3), advisors: [] }),
    [],
  );
});

test("la cadencia diaria retiene el caso hasta el tercer intento", () => {
  const now = new Date("2026-09-01T15:30:00.000Z"); // 10:30 Lima

  assert.equal(getBaseRecoveryNextTouchAt(1, now).getTime(), now.getTime());
  assert.equal(getBaseRecoveryNextTouchAt(2, now).getTime(), now.getTime());

  const next = getBaseRecoveryNextTouchAt(3, now);
  // Con el mínimo cumplido reaparece a las 9:00 de Lima del día siguiente.
  assert.equal(next.toISOString(), "2026-09-02T14:00:00.000Z");
  assert.equal(baseRecoveryMinimumDailyAttempts, 3);
});

test("la madrugada de Lima no salta un día de cadencia", () => {
  // 23:30 Lima del 1/09 = 04:30 UTC del 2/09: el "día siguiente" es el 2/09
  // en Lima, no el 3/09.
  const lateNight = new Date("2026-09-02T04:30:00.000Z");
  const next = getBaseRecoveryNextTouchAt(3, lateNight);
  assert.equal(next.toISOString(), "2026-09-02T14:00:00.000Z");
});

test("cuenta intentos del mismo día calendario de Lima", () => {
  const reference = new Date("2026-09-02T03:00:00.000Z"); // 22:00 Lima del 1/09
  const count = countOnSameLimaDay(
    [
      new Date("2026-09-01T14:00:00.000Z"), // 09:00 Lima del 1/09 → cuenta
      new Date("2026-09-02T02:00:00.000Z"), // 21:00 Lima del 1/09 → cuenta
      new Date("2026-09-02T06:00:00.000Z"), // 01:00 Lima del 2/09 → no
    ],
    reference,
  );
  assert.equal(count, 2);
});

test("la resolución obligatoria llega al séptimo día de gestión", () => {
  const claimedAt = new Date("2026-09-01T14:00:00.000Z");
  const dueAt = getBaseRecoveryResolutionDueAt(claimedAt);
  assert.equal(dueAt.toISOString(), "2026-09-08T14:00:00.000Z");

  assert.equal(
    isBaseRecoveryResolutionDue(claimedAt, new Date("2026-09-07T14:00:00.000Z")),
    false,
  );
  assert.equal(
    isBaseRecoveryResolutionDue(claimedAt, new Date("2026-09-08T14:00:00.000Z")),
    true,
  );
});

test("dos días sin ningún intento devuelven el caso al pool", () => {
  const claimedAt = new Date("2026-09-01T14:00:00.000Z");

  assert.equal(
    shouldReturnBaseCaseToPool({
      claimedAt,
      lastAttemptAt: null,
      now: new Date("2026-09-03T13:59:00.000Z"),
    }),
    false,
  );
  assert.equal(
    shouldReturnBaseCaseToPool({
      claimedAt,
      lastAttemptAt: null,
      now: new Date("2026-09-03T14:00:00.000Z"),
    }),
    true,
  );
});

test("un solo intento desde la asignación retiene el caso con su responsable", () => {
  const claimedAt = new Date("2026-09-01T14:00:00.000Z");

  assert.equal(
    shouldReturnBaseCaseToPool({
      claimedAt,
      lastAttemptAt: new Date("2026-09-01T18:00:00.000Z"),
      now: new Date("2026-09-10T14:00:00.000Z"),
    }),
    false,
  );

  // Un intento previo a la asignación (de un responsable anterior) no cuenta.
  assert.equal(
    shouldReturnBaseCaseToPool({
      claimedAt,
      lastAttemptAt: new Date("2026-08-30T18:00:00.000Z"),
      now: new Date("2026-09-03T14:00:00.000Z"),
    }),
    true,
  );
});

test("el bloque de toma del pool es de 10 casos", () => {
  assert.equal(baseRecoveryPoolTakeLimit, 10);
});

test("la verificación caduca al séptimo día desde el registro (BR-084)", async () => {
  const { isRecoveryConsultationExpired, recoveryConsultationMaxAgeDays } =
    await import("../dist/recovery-base-distribution.js");

  const registeredAt = new Date("2026-09-01T14:00:00.000Z");

  assert.equal(recoveryConsultationMaxAgeDays, 7);
  assert.equal(
    isRecoveryConsultationExpired(registeredAt, new Date("2026-09-08T13:59:00.000Z")),
    false,
  );
  assert.equal(
    isRecoveryConsultationExpired(registeredAt, new Date("2026-09-08T14:00:00.000Z")),
    true,
  );
});
