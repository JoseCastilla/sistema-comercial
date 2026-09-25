import assert from "node:assert/strict";
import test from "node:test";

import { describeSalesRecoveryWork } from "../dist/sales-recovery-work.js";

// Jueves 24/09/2026 a las 20:00 en Lima.
const ahora = new Date("2026-09-25T01:00:00.000Z");
const lima = (texto) => new Date(`${texto}-05:00`);

test("sin llamar y con las dos horas vencidas: rojo y «Llamar ya»", () => {
  const work = describeSalesRecoveryWork(
    {
      status: "ASSIGNED",
      saleAt: lima("2026-09-24T10:00"),
      firstContactAt: null,
      nextActionAt: null,
      noveltyAt: lima("2026-09-24T17:00"),
    },
    ahora,
  );
  assert.equal(work.action, "Llamar ya");
  assert.equal(work.due.tone, "danger");
  assert.equal(work.due.label, "venció hace 1 h");
});

test("sin llamar y dentro de las dos horas: ámbar y hasta qué hora", () => {
  const work = describeSalesRecoveryWork(
    {
      status: "ASSIGNED",
      saleAt: lima("2026-09-24T10:00"),
      firstContactAt: null,
      nextActionAt: null,
      noveltyAt: lima("2026-09-24T19:30"),
    },
    ahora,
  );
  assert.equal(work.action, "Llamar antes de las 21:30");
  assert.equal(work.due.tone, "warning");
});

test("una venta antigua no hace ruido: sin plazo ni color", () => {
  const work = describeSalesRecoveryWork(
    {
      status: "ASSIGNED",
      saleAt: lima("2026-08-20T10:00"),
      firstContactAt: null,
      nextActionAt: null,
      noveltyAt: lima("2026-09-24T10:00"),
    },
    ahora,
  );
  assert.equal(work.cold, true);
  assert.equal(work.due, null);
  assert.equal(work.action, "Sin llamar");
});

test("en verificación no toca nada hoy", () => {
  assert.equal(
    describeSalesRecoveryWork(
      {
        status: "WAITING",
        saleAt: lima("2026-09-24T10:00"),
        firstContactAt: lima("2026-09-24T11:00"),
        nextActionAt: null,
        noveltyAt: lima("2026-09-24T10:30"),
      },
      ahora,
    ),
    null,
  );
});
